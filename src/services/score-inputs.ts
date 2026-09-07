import { Measurement } from './measurement-store';

/** Select independently: a pending update must not displace a finalized value. */
export function scoreInputs(facts: Measurement[], version: string, confirmedOnly = false) {
    const latest = new Map<string, Measurement>();
    for (const f of facts) {
        if (f.version !== version || (confirmedOnly && f.status !== 'confirmed')) continue;
        const key = `${f.fact}:${f.account.uid}`;
        if (!latest.has(key) || f.jobID > latest.get(key).jobID) latest.set(key, f);
    }
    return [...latest.values()].map(f => ({ fact: f.fact, factData: f.factData }));
}
