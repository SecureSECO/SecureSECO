import Heap from 'heap-js';
import Emitter from 'node:events';
import { QueueTransaction } from '../types';
import {
    getAccount,
    getClient, getMinFee, getPrivateKey, runTransaction, getMinimumBounty
} from './dlt-service';
import { encodeAndSign } from './add-job-service'
import {CodaJob} from '../types'
import { APIClient } from '@klayr/api-client';
import { performance } from 'perf_hooks';

const heap = new Heap<QueueTransaction>(comparator);
var current_job: number | null = null;
const emitter = new Emitter();

export function addToHeap(transaction: QueueTransaction) {
    heap.add(transaction);
    emitter.emit('pushed', heap.size());
}

export function getQueueEmitter() {
    return emitter;
}

export function getHeapSize() {
    return heap.size();
}

export function clearQueue() {
    heap.clear();
}

export async function startQueue() {
    const client = await getClient();

    client.subscribe('chain_newBlock', async () => {
        await consumeFromHeap(client);
    });
}

async function consumeFromHeap(client: APIClient) {
    if (heap.isEmpty()) {
        current_job = null;
        return;
    }

    const queueTransaction = heap.pop();

    console.log(`Running transaction: ${queueTransaction.name}`);

    try {
        const data = queueTransaction.transaction.params.data;
        if (data)
        {
            var bounty = (data as CodaJob).bounty;
            current_job = (data as CodaJob).jobID;
        }
        const { slingers } = await getAccount();
        const minimumBounty = BigInt(await getMinimumBounty());

        if (bounty > slingers) {
            console.log('Not enough tokens to run this transaction, skipping...');
            await consumeFromHeap(client);
            return;
        }

        if (bounty < minimumBounty){
            console.log('Bounty to low, setting value to minimumBounty');
            let data = queueTransaction.transaction.params.data;
            (data as CodaJob).bounty = BigInt(minimumBounty);
            queueTransaction.transaction.params = await encodeAndSign(data as CodaJob);
        }

        const minFee = await getMinFee(queueTransaction.transaction);
        queueTransaction.transaction.fee = minFee;
        const transaction = await client.transaction.create(queueTransaction.transaction, getPrivateKey());
        await runTransaction(transaction);
    } catch (e) {
        console.log('Encountered error, if you believe this was a mistake, please run task again.');
        console.error(e, e.stack);
    }
}

function comparator(a: QueueTransaction, b: QueueTransaction) {
    const now = performance.now();
    const sinceA = a.created_at - now;
    const sinceB = b.created_at - now;

    return (a.priority + sinceA) - (b.priority + sinceB);
}

export function isJobInHeap(jobID: number): boolean {
    return jobID === current_job || heap.toArray().some((queueTransaction) => {
        const data = queueTransaction.transaction.params.data;
        if (data){
            return (data as CodaJob).jobID === jobID;
        }
        return false;
    })
}

/* This program has been developed by students from the bachelor Computer Science at Utrecht University within the Software Project course.
© Copyright Utrecht University (Department of Information and Computing Sciences) */
