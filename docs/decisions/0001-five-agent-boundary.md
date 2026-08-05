# ADR 0001: Five-agent boundary

Status: accepted

RetentionLab contains exactly five agents: Researcher, Designer, Maker, Communicator and Manager. Product features may invoke those agents in different modes, but may not introduce another autonomous role or independent system prompt.

The “Talk to the organisation” interface invokes the same Manager agent definition used in the pipeline. Its response mode is read-only and evidence-cited. It cannot approve a plan, publish communication, change billing, send a message or perform a customer mutation.

