# SecureSECO

This is the mother of the TrustSECO, FAIRSECO, and SearchSECO projects. It combines all together into one docker file, with a portal, that can activate all miners.

Basically, it takes what has been built for TrustSECO, and adds another screen for the SearchSECO miner, so that on your own computer you can manage how many miners you want to start at any time.

It should provide similar server logs as the SearchSECO controller client.

In the future it would be great if you could manage multiple servers under the same account data, so that with one interface, you can see all your nodes at work.

## installation instructions

- Install Docker Compose by following this guide: https://docs.docker.com/compose/install/
- Configure the local environment by copying `example.env` to `.env`, optionally editing the file
- Make the `run.sh` script executable by running the `chmod +x run.sh` command in the correct directory.
- Run the run.sh script by executing `./run.sh` in your terminal.
- Finished! Access the portal by visiting [localhost](http://localhost:3000/).
