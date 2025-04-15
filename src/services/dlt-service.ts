import { apiClient, transactions } from '@liskhq/lisk-client';
import { RegisteredModule } from '@liskhq/lisk-api-client/dist-node/types';
import { APIClient } from '@liskhq/lisk-api-client';
import fs from 'fs';
import {
    CodaJob, RandomJobResult, PackageData, Fact
} from '../types';
import axios from 'axios';
import 'dotenv/config';
import { getKeys } from '../keys';
import { addToHeap } from './queue-service';

const DLT_ENDPOINT = 'ws://dlt:8080/ws';
export const getPassphrase = () => 'wat het nu is ofzo maakt me echt niet uit';

let clientCache: APIClient;
const registeredTransactions: { [name: string]: { moduleID: number, assetID: number } } = {};

export const getClient = async () => {
    if (!clientCache) {
        clientCache = await apiClient.createWSClient(DLT_ENDPOINT);
        // eslint-disable-next-line no-use-before-define
        await loadTransactions();
    }
    return clientCache;
};

export async function storeGitHubLink(link: string): Promise<Boolean> {
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
        return false
    }
    const { publicKey } = await getKeys();
    if (publicKey.replace(/\s/g, "") !== data.replace(/\s/g, "")) {
        console.log("Local gpg key and public gpg key don't match!")
        return false;
    }

    const toStore = {
        github_link: link,
    };

    console.log("Storing gpg key...")
    await fs.promises.writeFile('storage.json', JSON.stringify(toStore), 'utf8');

    const module = registeredTransactions['accounts:AccountsAdd'];
    const transaction = {
        moduleID: module.moduleID,
        assetID: module.assetID,
        fee: BigInt(10000000),
        asset: {
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

export async function getGitHubLink() {
    if (!fs.existsSync('storage.json')) {
        return '';
    }

    const fileString = await fs.promises.readFile('storage.json', 'utf-8');
    const storage = JSON.parse(fileString);
    return storage.github_link;
}

export async function getJobs(): Promise<CodaJob[]> {
    const client = await getClient();
    return client.invoke('coda:getJobs');
}

export async function getRandomJob(): Promise<RandomJobResult> {
    const { id } = await getKeys();
    console.log(id);
    const client = await getClient();
    return client.invoke('coda:getRandomJob', {
        uid: id,
    });
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
    const res = await client.invoke('trustfacts:getPackageFacts', {
        packageName,
    }) as { facts: Fact[] } | [];
    if (Array.isArray(res) && res.length === 0) {
        return { facts: [] }
    }
    return res as { facts: Fact[] };
}

export function getModule(name: string) {
    return registeredTransactions[name];
}

export async function getPackageData(packageName): Promise<PackageData | []> {
    const client = await getClient();
    return client.invoke('packagedata:getPackageInfo', {
        packageName,
    });
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
    const packages: { packages: PackageData[] } | [] = await client.invoke('packagedata:getAllPackages');
    if (packages === []) {
        return []
    }
    // For each package get trust score, then sort the packages by score,
    // and grab the count top ones
    return (await Promise.all(
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
        }))).filter((pack) => pack !== null)
        .sort((a, b) => descending ? b.score - a.score : a.score - b.score)
        .slice(0, count);
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
    let packages: {packages: PackageData[]} = await client.invoke('packagedata:getAllPackages');
    if (query) {
        packages.packages = packages.packages.filter((pack) => pack.packageName.includes(query) || pack.packageOwner.includes(query));
    }
    let total = packages.packages.length;
    packages.packages = packages.packages.slice(from, typeof count === "number" && typeof from === "number" ? from + count : undefined);
    return { packages: packages.packages, total };
}

export async function getAllFacts(): Promise<string[]> {
    const client = await getClient();
    const facts: any[] = await client.invoke('coda:getAllFacts');
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
    return client.invoke('coda:encodeCodaJob', {
        ...codaJob,
    });
}

export async function encodeFact(data): Promise<string> {
    const client = await getClient();
    return client.invoke('trustfacts:encodeTrustFact', data);
}

export async function getMinimumBounty(): Promise<string> {
    const client = await getClient();
    return client.invoke('coda:getMinimumRequiredBounty');
}

export async function getTrustScoreCategories(packageName, version): Promise<Record<string, number>> {
    const client = await getClient();
    return client.invoke('trustfacts:calculateCategoryTrustScores', {
        packageName,
        version,
    });
}

export async function getTrustScore(packageName: string, version?: string): Promise<number | unknown> {
    const client = await getClient();
    const data = { packageName };
    if (version !== undefined) data["version"] = version;
    return client.invoke('trustfacts:calculateTrustScore', data);
}

export async function getAccount(): Promise<any> {
    const { id } = await getKeys();
    const client = await getClient();
    return client.invoke('accounts:getAccount', {
        uid: id,
    });
}

export async function runTransaction(transaction: Record<string, unknown>) {
    const client = await getClient();
    await client.transaction.send(transaction);
}

export async function getMinFee(transaction) {
    const client = await getClient();
    // eslint-disable-next-line no-param-reassign
    transaction.fee = BigInt(transactions.convertLSKToBeddows('1'));
    const signedTxWithSomeFee = await client.transaction.create(transaction, getPassphrase());
    return client.transaction.computeMinFee(signedTxWithSomeFee);
}

async function loadTransactions() {
    const client = await getClient();
    const response: RegisteredModule[] = await client.invoke('app:getRegisteredModules');

    response.forEach((module: RegisteredModule) => {
        module.transactionAssets.forEach((asset) => {
            registeredTransactions[`${module.name}:${asset.name}`] = {
                moduleID: module.id,
                assetID: asset.id,
            };
        });
    });
}

/* This program has been developed by students from the bachelor Computer Science at Utrecht University within the Software Project course.
© Copyright Utrecht University (Department of Information and Computing Sciences) */
