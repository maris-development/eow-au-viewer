#!/usr/bin/env bash

USER=smi9b6
SITE_SERVER=research.csiro.au
# Run this with 'npm run deploy:csiro' or directly
# Requires that the user running this has setup ssh keys on research.csiro.au
# See https://www.ssh.com/ssh/copy-id

if [ -f dist.tgz ]; then
  rm dist.tgz
fi

npm install

# Only build if was done more than a minute ago (since this script can be run from npm package.json
# where the build could also have been run)
DIST=$(find . -maxdepth 1 -type d -name dist -mmin +1)

for dist in $DIST
do
  echo "Building..."
  npm run build
done

tar --directory=dist/ng-eow -czvf dist.tgz ./
scp dist.tgz ${USER}@${SITE_SERVER}:/tmp

# Currently there is a 'leaflet' directory someone else owns and so I can't delete.  Which causes failure in the chain.
RM='find . -maxdepth 1 -path ./leaflet -prune -o -name '*' -exec rm -r {} \;'
# Replace with the following when some sysadmin removes that leaflet dir
#RM='rm -rf *'

ssh ${USER}@${SITE_SERVER} 'cd /srv/www/research.csiro.au/html/static/eyeonwater && eval "$RM" && cp /tmp/dist.tgz . && tar xzvf dist.tgz'
