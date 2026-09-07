import { getClient, getTrustFacts } from './dlt-service';
import { listMeasurements, saveMeasurement, reconcile } from './measurement-store';

export async function getMeasurements(name: string) {
    const local = listMeasurements(name);
    try {
        const client = await getClient();
        const before: any = await client.node.getNodeInfo();
        const { facts } = await getTrustFacts(name);
        const after: any = await client.node.getNodeInfo();
        // Retry on the next update rather than attach a value to the wrong head.
        if (before.lastBlockID !== after.lastBlockID) return { facts: local.map(({signature, ...m}) => m), ledgerAvailable: false };
        const canonical: Record<number, string> = { [after.height]: after.lastBlockID };
        for (const height of new Set(local.map(m => m.observedHeight).filter(h => h !== undefined))) {
            const block: any = await client.block.getByHeight(height);
            canonical[height] = block.header.id;
        }
        const merged = reconcile(local, facts, after.height, after.lastBlockID, after.finalizedHeight, canonical);
        for (const m of merged) {
            if (JSON.stringify(local.find(x => x.jobID === m.jobID && x.account.uid === m.account.uid)) !== JSON.stringify(m)) saveMeasurement(m);
        }
        return { facts: merged.map(({signature, ...m}) => m), ledgerAvailable: true };
    } catch {
        return { facts: local.map(({signature, ...m}) => m), ledgerAvailable: false };
    }
}
