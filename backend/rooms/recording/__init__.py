"""
Recording subsystem for the rooms app.

Contains the thin service that talks to LiveKit Egress, the host-only
control endpoints, and the webhook handler invoked by the egress
worker when an egress run starts/ends/fails.
"""
