import { spawn } from 'child_process';

/** Inspect public keys without importing them into the signing keyring. */
export function primaryFingerprints(armored: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const child = spawn('gpg', ['--batch', '--with-colons', '--show-keys']);
        let output = '';
        child.stdout.on('data', chunk => { output += chunk.toString(); });
        child.stderr.resume();
        child.on('error', reject);
        child.stdin.on('error', reject);
        child.on('close', code => {
            if (code !== 0) return reject(new Error('Invalid public GPG keys'));
            const fingerprints: string[] = [];
            let primary = false;
            for (const line of output.split('\n')) {
                const fields = line.split(':');
                if (fields[0] === 'pub') primary = true;
                else if (fields[0] === 'sub') primary = false;
                else if (fields[0] === 'fpr' && primary) {
                    fingerprints.push(fields[9].toUpperCase());
                    primary = false;
                }
            }
            resolve(fingerprints);
        });
        child.stdin.end(armored);
    });
}
