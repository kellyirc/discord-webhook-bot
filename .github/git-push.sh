#!/bin/sh

mkdir -p $HOME/.ssh

echo "$SSH_KEY" > $HOME/.ssh/id_rsa
chmod go-rwx $HOME/.ssh/id_rsa

echo "$SSH_KNOWN_HOSTS" > $HOME/.ssh/known_hosts

git config --global core.sshCommand "ssh -i $HOME/.ssh/id_rsa -o UserKnownHostsFile=$HOME/.ssh/known_hosts"

git push "$TARGET_GIT_URL" "$GITHUB_SHA":master
