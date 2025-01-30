/* eslint-disable no-await-in-loop */
import {
    encodeJob,
    getAllFacts,
    getMinimumBounty,
    getModule,
    getJobs,
    getTrustFacts,
    getPackageData
} from './dlt-service';
import { getTokens } from '../services/spider-service';
import { CodaJob, PackageData } from '../types';
import { getKeys, signMessage } from '../keys';
import { addToHeap } from './queue-service';
import axios, { AxiosResponse } from 'axios';
import semver from 'semver';

// @ts-ignore
// eslint-disable-next-line no-extend-native
BigInt.prototype.toJSON = function() {
    return this.toString();
};

/** Add all jobs for a specific package to the heap, ensuring the package also exists in the database. */
export default async function addAllJobs(packageData: PackageData) {
    await addPackage(packageData);
    // all jobs for the same package and release
    const known_jobs = (await getJobs()).filter(
        (job) => job.package === packageData.packageName
            && packageData.packageReleases.includes(job.version)
    ).map((job) => job.fact);
    const { id } = await getKeys();
    // all facts for the same package, version and the current user
    const known_facts = (await getTrustFacts(packageData.packageName)).facts.filter(
        (fact) => packageData.packageReleases.includes(fact.version) && fact.account.uid === id
    ).map((fact) => fact.fact);;
    // facts without the already known facts and jobs
    const facts = (await getAllFacts()).filter((fact) => !known_jobs.includes(fact) && !known_facts.includes(fact));
    for (const fact of facts) {
        await addJob(fact, packageData);
    }
}

/** Add a job to the heap. */
async function addJob(fact: string, packageData: PackageData) {
    for (let j = 0; j < packageData.packageReleases.length; j += 1) {
        const version = packageData.packageReleases[j];

        console.log(`Adding for version:${version} with fact:${fact}`);

        const bounty = await getMinimumBounty();

        const data: CodaJob = {
            package: packageData.packageName,
            version,
            fact,
            bounty: BigInt(bounty),
        };

        const job = await encodeAndSign(data);

        const module = getModule('coda:AddJob');
        const transaction = {
            moduleID: module.moduleID,
            assetID: module.assetID,
            fee: BigInt(10000000),
            asset: job,
        };

        addToHeap({
            name: 'AddJob',
            created_at: performance.now(),
            priority: 100,
            transaction,
        });
    }
}

/** Add package transaction to the heap */
async function addPackage(packageData: PackageData) {
    const pack = await getPackageData(packageData.packageName);
    // If all versions are already added, there is nothing left to do, so return
    if (pack !== [] &&
        packageData.packageReleases.every(
            (release) => (pack as PackageData).packageReleases.includes(release))
    ) {
        return;
    }

    const packageModule = getModule('packagedata:AddPackageData');
    const packageTransaction = {
        moduleID: packageModule.moduleID,
        assetID: packageModule.assetID,
        fee: BigInt(1000000),
        asset: packageData as unknown as Record<string, unknown>,
    };

    addToHeap({
        name: 'AddPackage',
        created_at: performance.now(),
        priority: 10,
        transaction: packageTransaction,
    });
}

/** Get the most recent version of a github repo based on semantic versioning,
 * excluding prerelease versions. */
export async function getMostRecentVersionGithub(
    packageData: PackageData,
): Promise<string> {
    let resp: AxiosResponse;
    try {
        let gh_token = (await getTokens()).github_token;
        let config = gh_token ? { headers: { Authorization: `token ${gh_token}` } } : {};
        resp = await axios.get(
            `https://api.github.com/repos/${packageData.packageOwner}/${packageData.packageName}/tags?per_page=100`,
            config
        );
    } catch (error) {
        console.log("error while retreiving github tags");
        console.log(`https://api.github.com/repos/${packageData.packageOwner}/${packageData.packageName}/tags?per_page=100`);
        return ""
    }
    let data = resp.data;
    let versions = data.map((x) => x.name)
    return getMostRecentVersion(versions);
}

/** Get the most recent version of a package based on semantic versioning,
 * excluding prerelease versions. */
export function getMostRecentVersion(versions: string[]): string {
    let parsed_versions: { raw_string: string; parsed: semver.SemVer }[] = [];
    for (let i = 0; i < versions.length; i++) {
        let tag = versions[i];
        // filter out pep 440 (python versioning standard) prereleases
        if (/(a|b|rc)\d+/.test(tag) || /\.dev\d+/.test(tag)) continue;
        let version = semver.coerce(tag, { includePrerelease: true });
        // filter out semantic version prereleases
        if (version !== null && version.prerelease.length === 0) {
            parsed_versions.push({ raw_string: tag, parsed: version });
        }
    }
    parsed_versions.sort((x, y) => semver.rcompare(x.parsed, y.parsed));
    return parsed_versions[0].raw_string;
}

export async function encodeAndSign(
    data: CodaJob,
): Promise<Record<string, any>> {
    const encoded = await encodeJob(data);
    const keys = await getKeys();
    const signature = await signMessage(encoded, keys.id);
    return {
        data,
        signature,
    };
}
/* This program has been developed by students from the bachelor Computer Science at Utrecht University within the Software Project course.
© Copyright Utrecht University (Department of Information and Computing Sciences) */
