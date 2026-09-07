import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export type MeasurementStatus = 'collected' | 'submitted' | 'recorded' | 'confirmed' | 'failed';
export interface Measurement {
    fact: string; factData: string; version: string; packageName: string;
    jobID: number; account: { uid: string }; status: MeasurementStatus;
    collectedAt?: string; source: string; signature?: string;
    transactionID?: string; observedHeight?: number; observedBlockID?: string;
    error?: string;
}
export const measurementEvents = new EventEmitter();
const file = process.env.MEASUREMENTS_FILE || 'data/measurements.json';
const records: Record<string, Measurement> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
export const measurementKey = (m: {jobID: number; account: {uid: string}}) => `${m.jobID}:${m.account.uid}`;
export function saveMeasurement(m: Measurement) {
    records[measurementKey(m)] = m;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(records), { mode: 0o600 });
    fs.renameSync(`${file}.tmp`, file);
    measurementEvents.emit('changed', m.packageName);
}
export const listMeasurements = (name?: string): Measurement[] => Object.values(records).filter(m => !name || m.packageName === name);
export function setSubmission(jobID: number, status: MeasurementStatus, transactionID?: string, error?: string) {
    for (const m of listMeasurements().filter(m => m.jobID === jobID && m.collectedAt)) {
        saveMeasurement({ ...m, status, transactionID: transactionID || m.transactionID, error });
    }
}
export const sourceFor = (fact: string) => ({gh: 'GitHub', lib: 'Libraries.io', cve: 'CVE collector', so: 'Stack Overflow', vs: 'ClamAV'}[fact.split('_')[0]] || 'Unknown');

/** Finality is conservative: the block where this node first observed the value
 * must still be canonical and finalized. Never infer finality from elapsed time. */
export function reconcile(records: Measurement[], ledger: any[], height: number, blockID: string,
    finalizedHeight: number, canonical: Record<number, string>): Measurement[] {
    const merged = new Map(records.map(m => [measurementKey(m), m]));
    for (const m of records) {
        const found = ledger.some(f => measurementKey(f) === measurementKey(m) && f.factData === m.factData);
        if (!found && (m.status === 'recorded' || m.status === 'confirmed'))
            merged.set(measurementKey(m), {...m, status: 'submitted', observedHeight: undefined, observedBlockID: undefined});
    }
    for (const f of ledger) {
        const previous = merged.get(measurementKey(f));
        const same = previous?.factData === f.factData;
        const validObservation = same && previous.observedHeight !== undefined &&
            canonical[previous.observedHeight] === previous.observedBlockID;
        const observedHeight = validObservation ? previous.observedHeight : height;
        const observedBlockID = validObservation ? previous.observedBlockID : blockID;
        merged.set(measurementKey(f), {...(same ? previous : {}), ...f, source: sourceFor(f.fact),
            observedHeight, observedBlockID,
            status: observedHeight <= finalizedHeight ? 'confirmed' : 'recorded', error: undefined});
    }
    return [...merged.values()];
}
