#!/usr/bin/env bash
set -e
sudo service postgresql start
sudo -u postgres createdb -O scopeproof scopeproof 2>/dev/null || true
echo "PostgreSQL setup complete"
