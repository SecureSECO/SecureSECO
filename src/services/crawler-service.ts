/** Module seperate from the rest of the project which gathers the most popular
 * packages and requests for the most recent version to be added.
 */
import axios from 'axios';
import addAllJobs from '../services/add-job-service';
import { PackageData } from '../types';

export async function runCrawler(
    package_manager: string,
    count: string,
    from: string
): Promise<string[]> {
    const resp = await axios.get(
        `http://spider:5000/get-most-popular-packages?platform=${package_manager}&count=${count}&from=${from}`,
    );
    const packages: PackageData[] = resp.data.map((p) => ({
        packageName: p.name.toLowerCase(),
        packagePlatform: p.platform.toLowerCase(),
        packageOwner: p.owner.toLowerCase(),
        packageReleases: [p.version],
    }));
    for (let pa of packages) {
        await addAllJobs(pa);
    }
    return packages.map((p) => p.packageName);
}
