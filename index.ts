import * as nsq from 'nsqjs';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as http from 'http';

interface IRepo {
  name: string;
  ssh: string;
  branch: string;
}

interface IConfig {
  nsqConsumerAddrs: string[];
  repos: IRepo[];
  triggerJobURL: string;
  triggerNpmBuildURL: string;
};

interface IProject {
  id: number;
  git_ssh_url: string;
};

interface IPushObject {
  object_kind: string;
  ref: string;
  project: IProject;
}

const getRepoPathFromSSHAddr = (ssh: string): string => {
  const s: string | undefined = ssh.split(':').pop();
  return s ? s : ssh;
};

const config: IConfig = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf8'));

const reader = new nsq.Reader('git_push', 'jenkins_hook_for_nanjing', {
  nsqdTCPAddresses: config.nsqConsumerAddrs,
});

const getRepoBySSH = (ssh: string): IRepo | null => {
  for (let i = 0; i < config.repos.length; i++) {
    if (config.repos[i].ssh === ssh) {
      return config.repos[i];
    }
  }

  return null;
};

reader.connect();

reader.on('message', (msg) => {
  const obj: IPushObject = JSON.parse(msg.body.toString());

  const repo = getRepoBySSH(obj.project.git_ssh_url);
  const branch = obj.object_kind === 'wiki_page' ? 'master' : obj.ref.split('/').pop();

  if (repo && repo.branch === branch) {
    const gitpath = getRepoPathFromSSHAddr(repo.ssh);
    http.get(`${config.triggerNpmBuildURL}&gitpath=${encodeURIComponent(gitpath)}&packagename=${repo.name}&branch=${branch}`, (res) => {
      console.log(`[JINKENS_HOOK INFO]: ${repo.name} ${branch} ${res.statusCode}`);

      if (res.statusCode === 201) {
        msg.finish();
      } else {
        msg.touch();
      }
    }).on('error', (e) => {
      console.error(`[JINKENS_HOOK ERROR] ${e.message}`);
      msg.touch();
    });
  } else {
    msg.finish();
  }
});

reader.on('error', (e) => {
  console.error(`[ERROR] MQ:${e.message}`);
});
