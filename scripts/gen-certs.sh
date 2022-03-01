#!/usr/bin/env bash
set -euo pipefail

declare default_name default_dest_dir
default_name="$(uname -n)"
default_dest_dir="$XDG_CONFIG_HOME/clipshare/certs"

if [[ $# -eq 0 || $1 =~ ^--?(h|help)$ ]]; then
  echo "USAGE: $(basename "${BASH_SOURCE[0]}") [NAME] [DEST]"
  echo
  echo "Generate OpenSSL certificates for use with Clipshare."
  echo
  echo "Certificates will be named NAME (default: $default_name)"
  echo "Certificates will be saved in DEST (default: $default_dest_dir}"
  echo "DEST will be created if it doesn't exist"
  exit 0
fi

declare name="${1:-$default_name}"
declare dest_dir="${2:-$default_dest_dir}"

for f in "$dest_dir/$name.key" "$dest_dir/$name.cert" "$dest_dir/$name.pem"; do
  if [[ -e "$f" ]]; then
    echo "error: $f exists, refusing to overwrite"
    exit 1
  fi
done

mkdir -vp "$dest_dir"
openssl req -verbose -nodes -new -x509 -keyout "$dest_dir/$name.key" -out "$dest_dir/$name.cert" -days 365 -subj "/CN=localhost"
echo "Created $dest_dir/$name.key"
echo "Created $dest_dir/$name.cert"
openssl x509 -in "$dest_dir/$name.cert" -out "$dest_dir/$name.pem" -outform PEM
echo "Created $dest_dir/$name.pem"

echo "Success."
echo "Copy $dest_dir/$name.pem to the certs/ directory on your remote machine"
