/* eslint-disable no-await-in-loop,no-continue */
import axios from 'axios';
import Emitter from 'node:events';
import {
    Job, RandomJobResult, SpiderJob, Tokens,
} from '../types';
import { encodeFact, getModule, getRandomJob, getAllUnfinishedJobs, getJobDetails } from './dlt-service';
import { getKeys, signMessage } from '../keys';
import { addToHeap } from './queue-service';

const SPIDER_ENDPOINT = 'http://spider:5000/';
const emitter = new Emitter();
const spider = axios.create({
    baseURL: SPIDER_ENDPOINT,
});
const retryCount = 2; // How often a job should be retried before giving up

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

        if (jobs.length === 0)
        {
            emitter.emit('info', 'No Spider job available! Sleeping for 30 sec.');
            await sleep(30 * 1000);
            continue;
        }

        let filteredJobs = jobs.filter(job => !(job.jobID in jobCounts && jobCounts[job.jobID] >= retryCount))

        if (filteredJobs.length === 0)
        {
            emitter.emit('info', 'All available spider jobs have been tried more than retry count already! Sleeping for 30 sec.');
            await sleep(30 * 1000);
            continue;
        }

        let job = await getJobDetails(filteredJobs[Math.floor(Math.random() * filteredJobs.length)]);

        emitter.emit('info', `Got Spider job for package ${job.package} with fact ${job.fact}`);

        const spiderResult = await runJob(job);


        const dataPoint = spiderResult[job.fact];

        if (dataPoint === undefined || dataPoint === null) {
            emitter.emit('info', `The spider returned null for ${job.fact}! Finding a new job!`);
            if (!(job.jobID in jobCounts))
                jobCounts[job.jobID] = 1
            else
                jobCounts[job.jobID] += 1
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

        const module = getModule('trustfacts:AddFacts');
        const transaction = {
            moduleID: module.moduleID,
            assetID: module.assetID,
            fee: BigInt(100000000),
            asset: trustFact as unknown as Record<string, unknown>,
        };

        emitter.emit('info', 'Finished job, adding to dlt queue!');

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
