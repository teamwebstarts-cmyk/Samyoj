#!/usr/bin/env bash
# Update project agent skills from skills-lock.json (skills.sh CLI).
set -euo pipefail
cd "$(dirname "$0")/.."
echo "Updating project skills from skills-lock.json..."
npx skills update -p -y
echo "Done. Review git diff under .agents/skills/ and skills-lock.json before commit."
