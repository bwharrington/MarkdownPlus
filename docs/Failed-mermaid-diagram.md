graph TD
    subgraph PVADMIN["PV ADMIN"]
        AnviAdmin["Anvi Admin"]
    end

    subgraph PVProduct["Portfolios or other product"]
        AnviChat["Anvi Chat ?"]
    end

    subgraph AnviAdminAPI["Anvi Admin API"]
        Store["Stores Records

Users
tenant id + product + service, user id

Roles
tenant id + product + service, role id"]
    end

    PVProduct -->|"Authentication through PV ADMIN\nPortfolios gets a user PTS Token"| PVADMIN

    AnviAdmin -->|"Full CRUD on adding or\nremoving users per Product/Service"| AnviAdminAPI

    AnviAdminAPI -->|"Check if user has access to\nProduct/Service (Anvi Chat)\n\nUse PTS Token for Authentication"| PVProduct
