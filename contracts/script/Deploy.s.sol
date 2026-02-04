// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SimpleEscrow} from "../src/SimpleEscrow.sol";

contract DeployScript is Script {
    // Base Sepolia USDC
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    // Base Mainnet USDC
    address constant USDC_BASE_MAINNET = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer address:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy SimpleEscrow with deployer as owner
        SimpleEscrow escrow = new SimpleEscrow(deployer);
        console.log("SimpleEscrow deployed at:", address(escrow));

        // Determine which USDC to use based on chain ID
        uint256 chainId = block.chainid;
        address usdc;

        if (chainId == 84532) {
            // Base Sepolia
            usdc = USDC_BASE_SEPOLIA;
            console.log("Chain: Base Sepolia");
        } else if (chainId == 8453) {
            // Base Mainnet
            usdc = USDC_BASE_MAINNET;
            console.log("Chain: Base Mainnet");
        } else {
            revert("Unsupported chain");
        }

        // Enable USDC
        escrow.setSupportedToken(usdc, true);
        console.log("USDC enabled:", usdc);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("Chain ID:", chainId);
        console.log("Escrow:", address(escrow));
        console.log("Owner:", deployer);
        console.log("USDC:", usdc);
    }
}
