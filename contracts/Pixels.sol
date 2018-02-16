pragma solidity ^0.4.17;

contract Pixels {

	struct Block {
		bytes32 title;
		bytes32 url;
		uint price;
		address owner;
		bytes32 ipfsImageHash;
	}

	mapping (uint => Block) allBlocks;

	address owner;

	event blockBought(uint blockNumber, address owner, uint price, bytes32 title, bytes32 url, bytes32 ipfsImageHash);

	function Pixels () {
		owner = msg.sender;  
	}


	modifier onlyOwner() { 
		require(msg.sender == owner);
		_; 
	}


	function withdraw (uint amount) onlyOwner external {
		require(amount <= this.balance);
		owner.transfer(amount);
	}

	function getBlocksPrice(uint[] requiredBlocks) constant internal returns(uint) {
		uint amountRequired = 0;
		for (uint i = 0; i < requiredBlocks.length; i++)
			amountRequired += allBlocks[requiredBlocks[i]].price == 0 ? 10000000000000000 : allBlocks[requiredBlocks[i]].price;
		return amountRequired;
	}

	function getBlockPrice(uint requiredBlock) constant public returns(uint) {
		if(allBlocks[requiredBlock].price == 0)
			return 10000000000000000;
		return allBlocks[requiredBlock].price;
	}


	function buyBlocks (uint[] requiredBlocks, bytes32 title, bytes32 url, bytes32[] ipfsImageHashes) external payable returns (uint) {
		require(requiredBlocks.length == ipfsImageHashes.length);
		require(getBlocksPrice(requiredBlocks) <= msg.value);
		for (uint i = 0; i < requiredBlocks.length; i++) {
			// First purchase
			if(allBlocks[requiredBlocks[i]].price == 0)
				allBlocks[requiredBlocks[i]].price = 10000000000000000; // 0.01 ETH

			else
				allBlocks[requiredBlocks[i]].owner.transfer(allBlocks[requiredBlocks[i]].price *  95 / 100);

			// Assign block data to required
			allBlocks[requiredBlocks[i]].title = title;
			allBlocks[requiredBlocks[i]].url = url;
			allBlocks[requiredBlocks[i]].ipfsImageHash = ipfsImageHashes[i];

			// Increase price if not self owned
			if (allBlocks[requiredBlocks[i]].owner != msg.sender)
				allBlocks[requiredBlocks[i]].price = allBlocks[requiredBlocks[i]].price * 15 / 10;
			
			// Assign block to buyer
			allBlocks[requiredBlocks[i]].owner = msg.sender;
			
			// Dispatch buying event
			blockBought(requiredBlocks[i], msg.sender, allBlocks[requiredBlocks[i]].price, title, url, ipfsImageHashes[i]);
		}
	}
}

