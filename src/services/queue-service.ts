import Heap from 'heap-js';
import Emitter from 'node:events';
import fs from 'fs';
import { QueueTransaction } from '../types';
import {
    getAccount,
    getClient, getMinFee, getPassphrase, runTransaction, getMinimumBounty
} from './dlt-service';
import { encodeAndSign } from './add-job-service'
import { CodaJob } from '../types'

const heap = new Heap<QueueTransaction>(comparator);
// Jobs that are waiting to be uploaded in the next block
var current_jobs: number[] = [];
// Keep track of payload size to avoid exceeding maximum size
var current_payload_size: number = 0;
var max_payload_size: number = 0;
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
    max_payload_size = (await client.node.getNodeInfo()).genesisConfig.maxPayloadLength;
    client.subscribe('app:block:new', async (event) => {
        current_jobs = [];
        current_payload_size = 0;
        console.log("----------NEW BLOCK---------------------")
        await consumeFromHeap(client);
    });
}

/** Consumes transactions from the heap until either the heap is empty of if
 * the payload limit has been reached for this block */
async function consumeFromHeap(client) {
    //while (!heap.isEmpty() && current_payload_size + transactionSize(heap.peek()) <= max_payload_size) {
    for (let i = 0; i<2 && !heap.isEmpty(); i++) {
        const queueTransaction = heap.pop();
        current_payload_size += transactionSize(queueTransaction);
        runQueuedTransactions(queueTransaction, client);
    }
}

async function runQueuedTransactions(queueTransaction: QueueTransaction, client) {
    console.log(`Running transaction: ${queueTransaction.name}`);

    try {
        const data = queueTransaction.transaction.asset.data;
        if (data) {
            var bounty = (data as CodaJob).bounty;
            current_jobs.push((data as CodaJob).jobID);
        }
        const { slingers } = await getAccount();
        const minimumBounty = BigInt(await getMinimumBounty());

        if (bounty > slingers) {
            console.log('Not enough tokens to run this transaction, skipping...');
            await consumeFromHeap(client);
            return;
        }

        if (bounty < minimumBounty) {
            console.log('Bounty to low, setting value to minimumBounty');
            let data = queueTransaction.transaction.asset.data;
            (data as CodaJob).bounty = BigInt(minimumBounty);
            queueTransaction.transaction.asset = await encodeAndSign(data as CodaJob);
        }

        const minFee = await getMinFee(queueTransaction.transaction);
        queueTransaction.transaction.fee = minFee;
        const transaction = await client.transaction.create(queueTransaction.transaction, getPassphrase());
        await runTransaction(transaction);
    } catch (e) {
        console.log('Encountered error, if you believe this was a mistake, please run task again.');
        //console.error(e);
        addToHeap(queueTransaction);
        //console.error(e, e.stack);
    }
}

function comparator(a: QueueTransaction, b: QueueTransaction) {
    const now = performance.now();
    const sinceA = a.created_at - now;
    const sinceB = b.created_at - now;

    return (a.priority + sinceA) - (b.priority + sinceB);
}

export function isJobInHeap(jobID: number): boolean {
    return current_jobs.includes(jobID) || heap.toArray().some((queueTransaction) => {
        const data = queueTransaction.transaction.asset.data;
        if (data) {
            return (data as CodaJob).jobID === jobID;
        }
        return false;
    })
}

/** Calculates the size of a transaction, this can be used to avoid sending
 * jobs that are to large for the chain. */
function transactionSize(transaction: QueueTransaction): number {
    return JSON.stringify(transaction.transaction).length;
}

/* This program has been developed by students from the bachelor Computer Science at Utrecht University within the Software Project course.
© Copyright Utrecht University (Department of Information and Computing Sciences) */
