/** Module seperate from the rest of the project which gathers the most popular
 * packages and requests for the most recent version to be added.
 */
import axios from 'axios';
import addAllJobs from './add-job-service';
import { PackageData } from '../types';
import { getPackagesData } from './dlt-service';

export async function runCrawler(
    packageManager: string,
    count: number,
    from: number,
): Promise<string[]> {
    const packages = await getMostPopularPackages(packageManager, count, from);
    for (let pa of packages) {
        await addAllJobs(pa);
    }
    return packages.map((p) => p.packageName);
}

let mostPopularPackagesCache: Record<string, PackageData[]> = {};
let packageCacheAge = new Date();

async function getMostPopularPackages(
    packageManager: string,
    count: number,
    from: number,
): Promise<PackageData[]> {
    const now = new Date();
    // refresh the cache if its older than a week
    if ((packageCacheAge.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7)) {
        packageCacheAge = now;
        mostPopularPackagesCache = {};
    }
    let cached = mostPopularPackagesCache[packageManager] || [];
    if (from + count <= cached.length) {
        return cached.slice(from, from + count);
    }
    // Start over if from is greater than cache
    if (from > cached.length) {
        cached = [];
    }
    const amountToFetch = from + count - cached.length;
    const resp = await axios.get(
        `http://spider:5000/get-most-popular-packages?platform=${packageManager}&count=${amountToFetch}&from=${cached.length}`
    );
    const newItems: PackageData[] = resp.data.map((p: any) => ({
        packageName: p.name.toLowerCase(),
        packagePlatform: p.platform.toLowerCase(),
        packageOwner: p.owner.toLowerCase(),
        packageReleases: [p.version],
    }));
    cached = cached.concat(newItems);
    mostPopularPackagesCache[packageManager] = cached;
    return cached.slice(from, from + count);
}

/** selects a new package to be crawled */
export async function nextPackage(packageManagers: string[]): Promise<PackageData | undefined> {
    const packages = await getPackagesData();
    if (packageManagers.length === 0) return undefined;
    // randomly choose packagemanager
    const packageManager = packageManagers[Math.floor(Math.random() * packageManagers.length)];
    const maxIndex = Math.min(
        15000, 
        packages.packages.filter((pack) => pack.packagePlatform === packageManager).length + 10
    );
    const popularPackages = await getMostPopularPackages(packageManager, maxIndex, 0);
    // Randomly choose te get a new package, or add a new version to an existing one
    // The more packages exist the higher the chance we add a new version to an existing package
    if (NToNChance(packages.total, 500)) {
        console.log("Next: add existing version to package");
        const averageVersionCount = packages.packages
            .filter((pack) => pack.packagePlatform === packageManager)
            .map((pack) => pack.packageReleases.length)
            .reduce((x, y) => x + y, 0) / packages.total;
        // Find first package that has a version count lower than the average
        const packag = popularPackages.find((pack) => {
            const existingPackage = packages.packages.find(
                (pack2) => pack2.packageName === pack.packageName
                    && pack2.packageOwner === pack.packageOwner
                    && pack2.packagePlatform === pack.packagePlatform,
            );
            return (existingPackage === undefined)
                || ((existingPackage.packageReleases.length < averageVersionCount)
                    && !existingPackage.packageReleases.includes(pack.packageReleases[0]));
        });
        if (packag === undefined) return popularPackages[0];
        return packag;
    }
    console.log("Getting first package that doesn't exist yet");
    return popularPackages.find((pack) => {
        const existingPackage = packages.packages.find(
            (pack2) => pack2.packageName === pack.packageName
                && pack2.packageOwner === pack.packageOwner
                && pack2.packagePlatform === pack.packagePlatform,
        );
        return existingPackage === undefined;
    });
}

/** Returns true with chance t to f,
 * Example: ntonChance(9, 1) returns true with 90% chance */
function NToNChance(t: number, f: number): boolean {
    return Math.floor(Math.random() * (t + f)) < t;
}
