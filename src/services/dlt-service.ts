import { apiClient, transactions } from '@klayr/client';
import { APIClient } from '@klayr/api-client';
import fs from 'fs';
import {
    CodaJob, RandomJobResult, PackageData, Fact
} from '../types';
import axios from 'axios';
import 'dotenv/config';
import { getKeys } from '../keys';
import { addToHeap } from './queue-service';
import { DecodedTransactionJSON } from '@klayr/api-client/dist-node/types';
import { performance } from 'perf_hooks';

const DLT_ENDPOINT = 'ws://dlt:7887/rpc-ws';
export const getPrivateKey = () => '51f54d4709f8cecbaa6787d0b38a295ff881de36a80c3dc1cc8b59fc15ef286f190a4c5974aa559b83bf00d4a6c4b2d1c9fe49696e1fbaefabb9b37e8ce5053a';

let clientCache: APIClient;

export const getClient = async () => {
    if (!clientCache) {
        clientCache = await apiClient.createWSClient(DLT_ENDPOINT);
    }
    return clientCache;
};

/** Checks if github gpg link exists and matches with local key */
export async function checkGitHubLink(link: string): Promise<boolean> {
    let data;
    try {
        data = (await axios.create().get(link)).data;
    } catch {
        console.log("Couldn't retrieve github link.");
        return false;
    }

    const storedOnGithub = !data.includes("This user hasn't uploaded any GPG keys.");
    if (!storedOnGithub) {
        console.log("User hasn't uploaded GPG keys yet.");
        return false;
    }
    const { publicKey } = await getKeys();
    if (publicKey.replace(/\s/g, "") !== data.replace(/\s/g, "")) {
        console.log("Local gpg key and public gpg key don't match!")
        return false;
    }

    return true;
}

/** Checks if the gpg key has been stored */
export async function settingsStored(): Promise<boolean> {
    const link = await getGitHubLink();
    const { slingers } = await getAccount();
    return checkGitHubLink(link) && slingers !== undefined;
}

export async function storeGitHubLink(link: string): Promise<boolean> {
    if (!await checkGitHubLink(link)) return false;

    const toStore = {
        github_link: link,
    };

    console.log("Storing gpg key...")
    await fs.promises.writeFile('storage.json', JSON.stringify(toStore), 'utf8');

    const transaction = {
        module: "accounts",
        command: "accountAdd",
        fee: BigInt(10000000),
        params: {
            url: link,
        },
    };

    addToHeap({
        transaction,
        name: 'AccountsAdd',
        priority: 5,
        created_at: performance.now(),
    });

    return true;
}

export async function getGitHubLink(): Promise<string> {
    if (!fs.existsSync('storage.json')) {
        return '';
    }

    const fileString = await fs.promises.readFile('storage.json', 'utf-8');
    const storage = JSON.parse(fileString);
    return storage.github_link;
}

export async function getJobs(): Promise<CodaJob[]> {
    const client = await getClient();
    return client.invoke('coda_getJobs');
}

export async function getAllUnfinishedJobs(): Promise<CodaJob[]> {
    const { id } = await getKeys();
    let allJobs = await getJobs();
    let unfinished = await Promise.all(allJobs.map(async job => {
        let trustFacts = (await getTrustFacts(job.package)).facts;
        if (trustFacts === undefined) return true;
        return !trustFacts.some(fact => fact.account.uid === id && fact.jobID === job.jobID);
    }))
    let unfinishedJobs = allJobs.filter((_, i) => unfinished[i]);
    return unfinishedJobs;
}

export async function getJobDetails(job: CodaJob): Promise<RandomJobResult> {
    let packageData = await getPackageData(job.package) as PackageData;

    return {
        package: job.package,
        version: job.version,
        fact: job.fact,
        date: job.date,
        jobID: job.jobID.toString(),
        bounty: job.bounty.toString(),
        account: {
            uid: job.account.uid,
        },
        packageName: packageData.packageName,
        packagePlatform: packageData.packagePlatform,
        packageOwner: packageData.packageOwner,
        packageReleases: packageData.packageReleases,
    }
}

export async function getTrustFacts(packageName: string): Promise<{ facts: Fact[] }> {
    const client = await getClient();
    const res = await client.invoke('trustfacts_getPackageFacts', {
        packageName,
    }) as unknown;
    if (typeof res === 'object' && res !== null && 'facts' in res && Array.isArray((res as any).facts)) {
        return res as { facts: Fact[] };
    }
    return { facts: [] };
}

export async function getPackageData(packageName: string): Promise<PackageData | []> {
    const client = await getClient();
    const res = await client.invoke('packageData_getPackageInfo', {
        packageName,
    });
    if (
        typeof res.packageName === 'string' &&
        typeof res.packagePlatform === 'string' &&
        typeof res.packageOwner === 'string' &&
        Array.isArray(res.packageReleases)
    ) {
        return res as unknown as PackageData;
    }
    // previous dlt version used empty list to indicate missing values, this is kept here to keep the api compatible
    return [];
}

export interface topPackageResult {
    packageName: string,
    packagePlatform: string,
    packageOwner: string,
    packageRelease: string,
    score: number,
}

/*** Get the packages with either highest (descending = true) or lowest trust
 * scores. For every package only the version with the highest trust score is considered. */
export async function getTopPackages(descending: boolean, count: number): Promise<topPackageResult[]> {
    const client = await getClient();
    const packages: { packages: PackageData[] } = await client.invoke('packageData_getAllPackages');

    // For each package get trust score
    let packagesWithScore = (await Promise.all(
        (packages as { packages: PackageData[] }).packages.map(async (pack) => {
            let score = await getTrustScore(pack.packageName);
            if (typeof score !== 'number') return null;
            return {
                packageName: pack.packageName,
                packagePlatform: pack.packagePlatform,
                packageOwner: pack.packageOwner,
                packageRelease: pack.packageReleases[0],
                score: score,
            }
        }))).filter((pack) => pack !== null);

    let compareFn = (a, b) => descending ? b.score - a.score : a.score - b.score;
    return get_top_elemenents(packagesWithScore, count, compareFn);
}

/** insert elem into a sorted list */
function insert_into_sorted_list<Elem>(list: Elem[], elem: Elem, compareFn: (a: Elem, b: Elem) => number) {
    list.push(elem);
    let index = list.length - 1;
    while (index > 0 && compareFn(elem, list[index - 1]) < 0) {
        [list[index], list[index-1]] = [list[index - 1], list[index]]; // switch elements
        index--;
    }
}

/** Get the count top elements from the list, based on the comparison function */
function get_top_elemenents<Elem>(list: Elem[], count: number, compareFn: (a: Elem, b: Elem) => number): Elem[] {
    let result = [];
    let i = 0;
    while (i < list.length && result.length < count)
    {
        insert_into_sorted_list(result, list[i], compareFn);
        i++;
    }

    if (result.length < count)
        return result;

    for (;i < list.length; i++)
    {
        let elem = list[i];
        if (compareFn(elem, list[count - 1]) < 0) {
            result.pop()
            insert_into_sorted_list(result, elem, compareFn);
        }
    }
    return result;
}

/** Return the version with the highest trust score of a specific package */
export async function mostTrustedVersion(packageName: string, versions: string[]): Promise<{ version: string, score: number } | null> {
    let best_version: null | { version: string, score: number } = null;
    for (let version of versions) {
        let score = await getTrustScore(packageName, version);
        if (typeof score !== 'number') continue;
        if (best_version === null || score <= best_version.score) {
            best_version = { version, score };
        }
    }
    return best_version
}

export async function getPackagesData(from?: number, count?: number, query?: string): Promise<{ packages: PackageData[], total: number }> {
    const client = await getClient();
    let packages: {packages: PackageData[]} = await client.invoke('packageData_getAllPackages');
    if (query) {
        packages.packages = packages.packages.filter((pack) => pack.packageName.includes(query) || pack.packageOwner.includes(query));
    }
    let total = packages.packages.length;
    packages.packages = packages.packages.slice(from, typeof count === "number" && typeof from === "number" ? from + count : undefined);
    return { packages: packages.packages, total };
}

export async function getAllFacts(): Promise<string[]> {
    const client = await getClient();
    const facts: any[] = await client.invoke('coda_getAllFacts');
    return facts.flatMap((o) => o.facts);
}

export async function getMetrics() {
    const { packages } = await getPackagesData();
    const packageCount = packages.length;

    const client = await getClient();
    const nodeInfo = await client.node.getNodeInfo();
    const blockHeight = nodeInfo.height;

    const info = await client.node.getNetworkStats();
    const peerInfo = {
        connected: info.totalConnectedPeers,
        disconnected: info.totalDisconnectedPeers,
        banned: info.banning.count,
    };

    return {
        package_count: packageCount,
        block_height: blockHeight,
        peer_info: peerInfo,
    };
}

export async function encodeJob(codaJob: CodaJob): Promise<string> {
    const client = await getClient();
    return client.invoke('coda_encodeCodaJob', {
        ...codaJob,
    });
}

export async function encodeFact(data): Promise<string> {
    const client = await getClient();
    return client.invoke('trustfacts_encodeTrustFact', data);
}

export async function getMinimumBounty(): Promise<string> {
    const client = await getClient();
    return client.invoke('coda_getMinimumRequiredBounty');
}

export async function getTrustScoreCategories(packageName, version): Promise<Record<string, number>> {
    const client = await getClient();
    return client.invoke('trustfacts_calculateCategoryTrustScores', {
        packageName,
        version,
    });
}

export async function getTrustScore(packageName: string, version?: string): Promise<number | unknown> {
    const client = await getClient();
    const data = { packageName };
    if (version !== undefined) data["version"] = version;
    return client.invoke('trustfacts_calculateTrustScore', data);
}

export async function getAccount(): Promise<any> {
    const { id } = await getKeys();
    const client = await getClient();
    return client.invoke('accounts_getAccount', {
        uid: id,
    });
}

export async function runTransaction(transaction: DecodedTransactionJSON<Record<string, unknown>>) {
    const client = await getClient();
    await client.transaction.send(transaction);
}

export async function getMinFee(transaction) {
    const client = await getClient();
    // eslint-disable-next-line no-param-reassign
    transaction.fee = BigInt(transactions.convertklyToBeddows('1'));
    const signedTxWithSomeFee = await client.transaction.create(transaction, getPrivateKey());
    return client.transaction.computeMinFee(signedTxWithSomeFee);
}

/* This program has been developed by students from the bachelor Computer Science at Utrecht University within the Software Project course.
© Copyright Utrecht University (Department of Information and Computing Sciences) */
