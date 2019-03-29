#! /usr/bin/env node

const shelljs = require('shelljs');
const fse = require('fs-extra');
const fs = require('fs');
const path = require('path');
const ProgressBar = require('progress');
const pkg = require('../package.json');

if (!shelljs.which('git')) {
  shelljs.echo('Sorry, this script requires git');
  shelljs.exit(1);
}

const CMD = Object.keys(pkg.bin)[0];
const CWD = process.cwd();
const DIR_REG = /node_modules/;

const getPath = (p, root) => path.resolve(root || CWD, p);

let root = CWD;

const argv = require('yargs')
    .usage(`Usage: ${CMD} [root] [options]`)
    .example(`${CMD} root -rb`, 'pull repository')
    .boolean('r')
    .alias('r', 'recursive')
    .describe('r', 'pull repository recursive')
    .boolean('b')
    .alias('b', 'bail')
    .describe('b', 'exit process when error')
    .help('h')
    .alias('h', 'help')
    .argv;

if (argv._.length > 0 && fse.pathExistsSync(argv._[0]) && fs.statSync(argv._[0]).isDirectory()) {
  root = getPath(argv._[0]);
}

const filter = (root, dirs = []) => dirs.map(dir => {
  const p = getPath(dir, root);
  if (fs.statSync(p).isDirectory() && !DIR_REG.test(dir)) {
    return p;
  }
}).filter(dir => !!dir);

const getDirs = rootDirs => {
  const dirs = rootDirs.filter(p => /\.git$/.test(p));
  if (dirs.length > 0) return [root]; // 当前目录是仓库
  const loop = localDirs => {
    for (let i = 0, len = localDirs.length; i < len; i++) {
      const dir = localDirs[i];
      const curPath = path.resolve(dir, '.git');
      if (fse.pathExistsSync(curPath) && fs.statSync(curPath).isDirectory()) {
        dirs.push(dir);
      } else {
        argv.r && loop(filter(dir, shelljs.ls(dir))); // 是否递归
      }
    }
  }
  loop(rootDirs);
  return dirs;
}

const dirs = getDirs(filter(root, shelljs.ls(root)));

const bar = new ProgressBar('|:bar| 当前:token :current/:total :etas', {
  complete: '+',
  incomplete: ' ',
  width: 30,
  total: dirs.length,
});

const failRepos = [];

dirs.forEach(dir => {
  shelljs.cd(dir);
  const execRet = shelljs.exec('git pull', { silent: true });
  bar.tick(1, { 'token': dir });
  if (execRet.code !== 0) {
    failRepos.push({
      dir,
      stderr: execRet.stderr,
    });
    if (argv.b) {
      shelljs.echo(`\n pull ${dir} fail \n ${execRet.stderr}`);
      shelljs.exit(1);
    } // 报错是否退出
  }
});

console.log('\n更新完成!');
failRepos.length > 0 && console.log(`\n以下仓库更新失败：${failRepos.map(repo => `\n\n${repo.dir}\n${repo.stderr}\n===============================`).join(' ')}`);
