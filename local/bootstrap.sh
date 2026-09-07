#!/bin/sh
# Fetch the three independently versioned components used by compose.local.yaml.
set -eu
cd "$(dirname "$0")/.."
mkdir -p components
if [ ! -d components/portal ]; then
  git clone --branch fix/live-measurements https://github.com/SecureSECO/SecureSECO-Portal.git components/portal
fi
if [ ! -d components/ledger ]; then
  git clone --branch fix/github-key-registration https://github.com/SecureSECO/TrustSECO-DLT.git components/ledger
fi
if [ ! -d components/spider ]; then
  git clone --branch final-spider-fixes https://github.com/SecureSECO/TrustSECO-Spider.git components/spider
fi
