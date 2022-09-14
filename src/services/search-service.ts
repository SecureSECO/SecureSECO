/* eslint-disable no-await-in-loop,no-restricted-syntax,camelcase */
import 'dotenv/config';
import util from 'node:util';
import { execFile } from 'node:child_process';
import { Miner } from '../types';

const execDocker = (args: string[]) => util.promisify(execFile)('docker', args);

export async function getMiner(id: string): Promise<Miner> {
    const { stdout } = await execDocker(['inspect', id]);

    const info = JSON.parse(stdout).at(0);

    // Convert info.Config.Env array to key=>value object
    // "Env": [
    //   "github_token=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    //   "worker_name=xxxx",
    // ],
    const env: Miner['config'] = {};
    info.Config.Env.forEach((e: string) => {
        const [key, value] = e.split('=');
        env[key] = value;
    });

    return {
        id,
        // remove initial "/" from docker container name
        name: info.Name ? info.Name.replace(/\//, '') : '',
        config: {
            github_token: env.github_token,
            worker_name: env.worker_name,
            cpus: env.cpus,
        },
        state: info.State,
    };
}

export async function getMiners(): Promise<Miner[]> {
    const miners = [] as Miner[];

    const { stdout } = await execDocker([
        'ps',
        '--all',
        '--filter',
        `ancestor=${process.env.SEARCHSECO_CONTROLLER_IMAGE}`,
        '--format',
        '{{.ID}}',
    ]);

    for (const id of stdout.split('\n')) {
        if (id.length > 0) {
            const miner = await getMiner(id);
            miners.push(miner);
        }
    }

    return miners;
}

export async function getMetrics() {
    return {
        methods_added_4hrs: [],
        methods_added_lifetime: [],
        last_activity: [],
    };
}

export const createMiner = async (params: Miner['config']) => {
    // TODO params.cpus
    // TODO params.verbose
    const { github_token, worker_name } = params;

    try {
        await execDocker([
            'run',
            '-e',
            `github_token=${github_token}`,
            '--cpus=2',
            '-e',
            `worker_name=${worker_name}`,
            process.env.SEARCHSECO_CONTROLLER_IMAGE,
        ]);
        return {
            success: true,
            message: 'Added Miner.',
        };
    } catch (e) {
        return {
            success: false,
            message: e.message,
        };
    }
};

export const changeMinerState = async (id: string, action: string) => {
    let cmd = '';
    switch (action) {
        case 'remove':
            cmd = 'rm';
            break;

        case 'restart':
        case 'start':
        case 'stop':
            cmd = action;
            break;

        default:
            console.log('error! unknown action', action);
            return false;
    }
    const { stdout, stderr } = await execDocker([cmd, id]);
    console.log(`changeMinerState(${id}, ${action})`);
    if (stderr) {
        console.log(`changeMinerState(${id}, ${action}): ERROR`, stderr.trim());
    }
    return { stdout, stderr };
};
