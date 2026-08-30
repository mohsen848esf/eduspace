#!/bin/sh
# Egress joins group 2000; new recording directories must remain group-writable.
umask 0002
exec "$@"
