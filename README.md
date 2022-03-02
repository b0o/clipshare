# Clipshare [![Version](https://img.shields.io/github/v/tag/b0o/clipshare?style=flat&color=yellow&label=version&sort=semver)](https://github.com/b0o/clipshare/releases) [![License: MIT](https://img.shields.io/github/license/b0o/clipshare?style=flat&color=green)](https://www.mit-license.org/)

Securely synchronize your clipboard across multiple computers. This is alpha-quality software, proceed with caution!

## Usage

```
$ node ./src/index.js --help

  Securely synchronize your clipboard across multiple computers

  Usage
    $ clipshare [OPTS]

  Options
    --listen    -l  Address and port listen on, of the form [addr][:port].
                    Default: localhost:47880

    --name          Name of the local server (used to find the local TLS certificate).
                    Default: local

    --remote    -r  URL of remote peer to share clipboard with.

    --remote-name   Name of remote peer (used to find the remote TLS certificate).
                    Default: remote

    --password  -P  Password used to authenticate with remote peer.
```

## Configuration

`$XDG_CONFIG_HOME/clipshare/config.yml`:

```yml
listen: "localhost:10230"
remote: "https://100.200.13.37:10230"
password: "59051cb5e1e2"
name: "janes-desktop"
remote_name: "janes-laptop"
```

## SSL Certificates

Generate a self-signed certificate on each machine separately using [`./scripts/gen-certs.sh`](https://github.com/b0o/clipshare/blob/main/scripts/gen-certs.sh):

```
$ ./scripts/gen-certs.sh NAME
mkdir: created directory '/home/maddy/.config/clipshare'
mkdir: created directory '/home/maddy/.config/clipshare/certs'
Using configuration from /etc/ssl/openssl.cnf
Generating a RSA private key
...................................+++++
..........................................................+++++
writing new private key to '/home/maddy/.config/clipshare/certs/maddymach.key'
-----
Created /home/maddy/.config/clipshare/certs/maddymach.key
Created /home/maddy/.config/clipshare/certs/maddymach.cert
Created /home/maddy/.config/clipshare/certs/maddymach.pem
Success.
Copy /home/maddy/.config/clipshare/certs/maddymach.pem to the certs/ directory on your remote machine
```

`NAME` is the name you'd like to give to the device, corresponding to the `name` configuration field.

Transfer the local `.pem` file to the remote host's `certs` directory and the remote `.pem` file to the local host's `certs` directory.
These files are used by each peer to explicitly trust the other peer's certificate without the need for a certificate authority.

The name of the remote's `.pem` file should be the same as the local host's `remote_name` configuration field.

## Changelog

```
28 Feb 2022                                                             v0.0.1
  Initial Release
```

## License

&copy; 2021-2022 Maddison Hellstrom

Released under the MIT License.
