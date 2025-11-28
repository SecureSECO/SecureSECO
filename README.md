# SecureSECO

This is the mother of the TrustSECO and SearchSECO projects. It combines all together into one docker compose project, with a portal, that can activate all miners.

It consists of the following projects:
- [TrustSECO Spider](https://github.com/SecureSECO/TrustSECO-Spider): simple REST API created with Python and
Flask, where information about packages can be requested, such as the amount of stars a repo has, or how old the
package is.
- [TrustSECO DLT](https://github.com/SecureSECO/TrustSECO-DLT): the distributed ledger where the data of
TrustSECO is stored in a blockchain. Created with Typescript and the Klayr SDK.
- TrustSECO Cosy: This project, it provides a simple API to the Spider, DLT, and controls
the automatic spidering of jobs. It also provides an API for creating SearchSECO instances.
Created with Typescript and Koa.
- [SecureSECO Portal](https://github.com/SecureSECO/SecureSECO-Portal): the frontend of the project where users
can request packages, enable spidering and look at package information of TrustSECO and
add SearchSECO miners, in a easy to use web UI.
- [SearchSECO Controller](https://github.com/SecureSECO/SearchSECOController): Controls the other modules of
the SearchSECO project.

## Features

In TrustSECO you can:
- View trust data for software packages.
- Evaluate software packages based on an aggregated trust score, based on the trust data.
- Request for data to be gathered of a package.
- Earn tokens by running the spider locally. 

## Installation instructions

- Install Docker Compose by following this guide: https://docs.docker.com/compose/install/
- Configure the local environment by copying `example.env` to `.env`, optionally editing the file
- Make the `run.sh` script executable by running the `chmod +x run.sh` command in the correct directory.
- Run the run.sh script by executing `./run.sh` in your terminal.
- Finished! Access the portal by visiting [localhost:3000](http://localhost:3000/).

## Screenshots
### TrustSECO

**Homepage:**
![Screenshot showing the homepage of TrustSECO. It contains three sections: About TrustSECO, containing information about the project. Cosy and Spider status, where the spider can be toggled on. And a list op packages with the highest trust score.](screenshots/trust_home.png)

**Packages view:**
![Screenshot showing the packages/trust scores view of TrustSECO. It contains a list of packages and their trust scores.](screenshots/packages.png)

**Package view:**
![Screenshot showing a package view of TrustSECO. It contains information such as downloads about the boto python package.](screenshots/packages.png)

**Add package menu:**
![Screenshot showing the add package menu. A new package can be requested here.](screenshots/packages.png)

**Job list:**
![Screenshot showing the TrustSECO job list. A table of facts such as GitHub contributor count that were requested to be spidered.](screenshots/job_list.png)

### SearchSECO
![Screenshot showing a table UI where miner instances are listed, with an interface to enable/disable them, refresh them and delete them](screenshots/search_miners.png)

![Screenshot showing a form UI with the text fields "Github token" and "worker name" and a submit button](screenshots/search_add_miner.png)
