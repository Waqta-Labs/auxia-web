export const EXPLORER_TX_URL = 'https://sepolia.etherscan.io/tx/';

export class Delivery {
  constructor({ id, status, transactionHash = null, originName = null, destinationName = null }) {
    this.id = id;
    this.status = status;
    this.transactionHash = transactionHash;
    this.originName = originName;
    this.destinationName = destinationName;
    Object.freeze(this);
  }

  get explorerUrl() {
    return this.transactionHash ? EXPLORER_TX_URL + this.transactionHash : null;
  }
}
