/* eslint-disable no-await-in-loop,no-continue */
import axios from 'axios';
import Emitter from 'node:events';
import {
    RandomJobResult, SpiderJob, Tokens,
} from '../types';
import { encodeFact, getAllUnfinishedJobs, getJobDetails } from './dlt-service';
import { getKeys, signMessage } from '../keys';
import { addToHeap, isJobInHeap } from './queue-service';
import { storeGitHubLink } from './dlt-service';
import { performance } from 'perf_hooks';

const SPIDER_ENDPOINT = 'http://spider:5000/';
const emitter = new Emitter();
emitter.on("info", (message) => console.log(`INFO:${message}`));
const spider = axios.create({
    baseURL: SPIDER_ENDPOINT,
});
const retryCount = 2; // How often a job should be retried before giving up

/** Loads the spider settings from environments variables if they are set. */
export async function loadSpiderSettings() {
    let tokens = {
        github_token: process.env.GITHUB_TOKEN,
        libraries_token: process.env.LIBRARIESIO_TOKEN,
    };
    if (tokens.github_token && tokens.libraries_token) {
        await setTokens(tokens);
    }
    let gh_username = process.env.GH_USERNAME;
    if (gh_username) {
        await storeGitHubLink(`https://github.com/${gh_username.toLowerCase()}.gpg`)
    }
    let spider_enabled = process.env.ENABLE_SPIDER;
    if (spider_enabled && spider_enabled === "true") {
        await startSpider();
    }
}

export async function setTokens(tokens: Tokens): Promise<string> {
    const { data } = await spider.post('set_tokens', tokens);
    return data;
}

export async function getTokens(): Promise<Tokens> {
    const { data } = await spider.get('get_tokens');
    return data;
}

export function getSpiderEmitter(): Emitter {
    return emitter;
}

export async function runJob(job: RandomJobResult): Promise<unknown> {
    const spiderJob: SpiderJob = {
        project_info: {
            project_platform: job.packagePlatform,
            project_owner: job.packageOwner,
            project_name: job.packageName,
            project_release: job.version,
        },
    };

    switch (job.fact.split('_')[0]) {
        case 'cve':
            spiderJob.cve_data_points = [job.fact];
            break;
        case 'so':
            spiderJob.so_data_points = [job.fact];
            break;
        case 'lib':
            spiderJob.lib_data_points = [job.fact];
            break;
        case 'gh':
            spiderJob.gh_data_points = [job.fact];
            break;
        case 'vs':
            spiderJob.virus_scanning = [job.fact];
            break;
        default:
            break;
    }

    const { data } = await spider.post('get_data', spiderJob);
    return data;
}

let running = false;

export async function startSpider() {
    running = true;
    let jobCounts = {}; // the amount of times a job has failed

    while (running) {
        let jobs = await getAllUnfinishedJobs();

        if (jobs.length === 0) {
            emitter.emit('info', 'No Spider job available! Sleeping for 30 sec.');
            await sleep(30 * 1000);
            continue;
        }

        let filteredJobs = jobs.filter(job =>
            !(job.jobID in jobCounts && jobCounts[job.jobID] >= retryCount) &&
            !(isJobInHeap(job.jobID)))

        if (filteredJobs.length === 0) {
            emitter.emit('info', 'All available spider jobs have been tried more than retry count already! Sleeping for 30 sec.');
            await sleep(30 * 1000);
            continue;
        }

        let job = await getJobDetails(filteredJobs[Math.floor(Math.random() * filteredJobs.length)]);

        emitter.emit('info', `Got Spider job for package ${job.package} with fact ${job.fact}`);

        let spiderResult; 
        try {
            spiderResult = await runJob(job);
        } catch (e) {
            emitter.emit('info', `Error requesting data from the spider! ${e} Finding a new job!`);
            await sleep(5 * 1000);
            continue;
        }

        if (!(job.jobID in jobCounts))
            jobCounts[job.jobID] = 1
        else
            jobCounts[job.jobID] += 1

        const dataPoint = spiderResult[job.fact];

        if (dataPoint === undefined || dataPoint === null) {
            emitter.emit('info', `The spider returned null for ${job.fact}! Finding a new job!`);
            await sleep(5 * 1000);
            continue;
        }

        emitter.emit('info', `The ${job.fact} for ${job.package} is ${dataPoint}`);

        const keys = await getKeys();

        const data = {
            jobID: Number(job.jobID),
            factData: JSON.stringify(dataPoint),
        };

        const encoded = await encodeFact(data);

        const signature = await signMessage(encoded, keys.id);

        const trustFact = {
            data,
            signature,
        };

        const transaction = {
            module: "trustfacts",
            command: "addFact",
            fee: BigInt(100000000),
            params: trustFact as unknown as Record<string, unknown>,
        };

        emitter.emit('info', `Finished job ${job.jobID}, adding to dlt queue!`);

        addToHeap({
            transaction,
            created_at: performance.now(),
            priority: 200,
            name: 'fact',
        });

        await sleep(30 * 1000);
    }
}

export function stopSpider() {
    running = false;
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export function isRunning(): boolean {
    return running;
}

/* This program has been developed by students from the bachelor Computer Science at Utrecht University within the Software Project course.
© Copyright Utrecht University (Department of Information and Computing Sciences) */
