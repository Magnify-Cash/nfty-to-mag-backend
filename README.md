# nfty-to-mag
# Bridge backend

The backend works as event parser and transaction sender. Implements next general flow:
- Parse all `Send` events from `source` network. New transaction with status `SENT` created in db.
- After `Send` event was handled, send transaction to bridge contract to `block` bridging process in source network. 
Updates transaction status to `BLOCKED`
- After `blocking` executes withdraw process in `destination` network.
- When withdrawal is finished mark the transaction as `COMPLETED` status.
- Stuck bridging transaction will refund automatically by back-end, or can be refund manually by calling bridge contract.
In that case transaction status will be changed to `REFUNDED`.

In order to operate with networks and send transactions, back-end requires RPC for `source` and `destination` networks.
Each bridge instance also requires accounts in each network (private keys in .env). We call this accounts Admin.
Each Admin account must have Relayer role on bridge contracts (`RELAYER_ROLE`).
All RPCs, contract addresses, private keys are stored in `.env`.

## Environment Variables
| Environment Variable         | Type   | Default Value   | Description                                           |
|------------------------------|--------|-----------------|-------------------------------------------------------|
| `PORT`                       | number | 3000            |                                                       |
| `CORS_WHITELIST`             | String | No origin added | Whitelisted origins separated by `,`                  |
| `SOURCE_RPC`                 | String |                 | RPC for source network                                |
| `SOURCE_ADMIN_PK`            | String |                 | PK for Admin Account in source network                |
| `SOURCE_BRIDGE_ADDRESS`      | String |                 | Bridge contract address in source network             |
| `SOURCE_CREATION_BLOCK`      | String |                 | Bridge contract deploy block in destination network   |
| `DESTINATION_RPC`            | String |                 | RPC for destination network                           |
| `DESTINATION_ADMIN_PK`       | String |                 | PK for Admin Account in destination network, separate for each source-destination pair |
| `DESTINATION_BRIDGE_ADDRESS` | String |                 | Bridge contract address in destination network        |
| `DESTINATION_CREATION_BLOCK` | String |                 | Bridge contract creation block in destination network |
| `MONGO_URL`                  | String |                 | Connection URL to mongodb                             | 

> **_IMPORTANT_**: Admin accounts must have native coin balance in order to send transaction.

---

## API

### Getting user order by address

#### Query:

```
https://{host}/user/order?userAddress=0x...12
```

#### Response:

```json5
{
   "_id": "NETWORK_NAME-ID",
   "createdAt": "2024-07-02T15:27:42.204Z",
   "fromChain": "source",
   "toChain": "destination",
   "nonce": "12",
   "fromUser": "0x6385597005A041Ad43Ef136e2a683E4469b1041A",
   "toUser": "0x6385597005A041Ad43Ef136e2a683E4469b1041A",
   "tokenFromChain": "0x0B5d53E3b79e3317A17AD5F61910d4F807eCa56a",
   "tokenOtherChain": "0xaC9809c3cdBa4052F39501DEC700fc23776e40AF",
   "amount": "20000000000000000000",
   "status": "COMPLETE",
   "sendTxHash": "0x892e19a30012de1c560a9a159904427e5f9ef508b25a132c8b6005d5b39c3c2a",
   "createdOnBlock": 8985063,
   "createdTimestamp": 1719934062204,
   "__v": 0,
   "updatedTimestamp": 1719934083071,
   "withdrawTxHash": "0xcf601399828c9c6f6c1cd68d75b96501f41da52d730bf828be55696f71821c61"
}

200 OK
```


---

## Prerequisites

1. Node.js v20.12.2
2. NPM v10.5.2
3. Docker & Docker compose (optional)
4. Mongo DB

## Deployment

### Source Code

1. Install dependecies

   ```bash
   npm i
   
   ```
2. Build

   ```bash 
   npm run build
   ```
3. Run

   ```bash
   npm run start
   ```

### Docker

1. Build
   ```bash
   docker build -t bridge-backend .
   ```
2. Run
   ```bash
   docker run [-d] [-p <HOST_PORT>:<CONTAINER_PORT>] --env-file <PATH_TO_ENV_FILE> bridge-backend
   ```
