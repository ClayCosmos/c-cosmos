// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {SimpleEscrow} from "../src/SimpleEscrow.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract SimpleEscrowTest is Test {
    SimpleEscrow public escrow;
    MockERC20 public usdc;

    address public owner = address(1);
    address public buyer = address(2);
    address public seller = address(3);

    uint256 public constant INITIAL_BALANCE = 1000 * 1e6; // 1000 USDC
    uint256 public constant ORDER_AMOUNT = 10 * 1e6; // 10 USDC

    bytes32 public orderId = keccak256("order-001");

    function setUp() public {
        // Deploy contracts
        usdc = new MockERC20("USD Coin", "USDC", 6);
        escrow = new SimpleEscrow(owner);

        // Setup token support
        vm.prank(owner);
        escrow.setSupportedToken(address(usdc), true);

        // Fund buyer
        usdc.mint(buyer, INITIAL_BALANCE);

        // Approve escrow
        vm.prank(buyer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ============ Create Order Tests ============

    function test_CreateOrder() public {
        uint256 deadline = block.timestamp + 7 days;

        vm.prank(buyer);
        escrow.createOrder(orderId, seller, address(usdc), ORDER_AMOUNT, deadline);

        SimpleEscrow.Order memory order = escrow.getOrder(orderId);

        assertEq(order.buyer, buyer);
        assertEq(order.seller, seller);
        assertEq(order.token, address(usdc));
        assertEq(order.amount, ORDER_AMOUNT);
        assertEq(order.deadline, deadline);
        assertEq(uint256(order.status), uint256(SimpleEscrow.OrderStatus.Created));

        // Check balances
        assertEq(usdc.balanceOf(buyer), INITIAL_BALANCE - ORDER_AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), ORDER_AMOUNT);
    }

    function test_CreateOrder_RevertIfOrderExists() public {
        uint256 deadline = block.timestamp + 7 days;

        vm.prank(buyer);
        escrow.createOrder(orderId, seller, address(usdc), ORDER_AMOUNT, deadline);

        vm.prank(buyer);
        vm.expectRevert(SimpleEscrow.OrderAlreadyExists.selector);
        escrow.createOrder(orderId, seller, address(usdc), ORDER_AMOUNT, deadline);
    }

    function test_CreateOrder_RevertIfUnsupportedToken() public {
        address fakeToken = address(999);
        uint256 deadline = block.timestamp + 7 days;

        vm.prank(buyer);
        vm.expectRevert(SimpleEscrow.UnsupportedToken.selector);
        escrow.createOrder(orderId, seller, fakeToken, ORDER_AMOUNT, deadline);
    }

    function test_CreateOrder_RevertIfInvalidDeadline() public {
        uint256 tooSoon = block.timestamp + 30 minutes;

        vm.prank(buyer);
        vm.expectRevert(SimpleEscrow.InvalidDeadline.selector);
        escrow.createOrder(orderId, seller, address(usdc), ORDER_AMOUNT, tooSoon);
    }

    // ============ Complete Order Tests ============

    function test_Complete() public {
        uint256 deadline = block.timestamp + 7 days;

        vm.prank(buyer);
        escrow.createOrder(orderId, seller, address(usdc), ORDER_AMOUNT, deadline);

        uint256 sellerBalanceBefore = usdc.balanceOf(seller);

        vm.prank(buyer);
        escrow.complete(orderId);

        SimpleEscrow.Order memory order = escrow.getOrder(orderId);
        assertEq(uint256(order.status), uint256(SimpleEscrow.OrderStatus.Completed));

        // Check seller received funds
        assertEq(usdc.balanceOf(seller), sellerBalanceBefore + ORDER_AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_Complete_RevertIfNotBuyer() public {
        uint256 deadline = block.timestamp + 7 days;

        vm.prank(buyer);
        escrow.createOrder(orderId, seller, address(usdc), ORDER_AMOUNT, deadline);

        vm.prank(seller);
        vm.expectRevert(SimpleEscrow.Unauthorized.selector);
        escrow.complete(orderId);
    }

    // ============ Cancel Order Tests ============

    function test_Cancel() public {
        uint256 deadline = block.timestamp + 7 days;

        vm.prank(buyer);
        escrow.createOrder(orderId, seller, address(usdc), ORDER_AMOUNT, deadline);

        uint256 buyerBalanceBefore = usdc.balanceOf(buyer);

        vm.prank(buyer);
        escrow.cancel(orderId);

        SimpleEscrow.Order memory order = escrow.getOrder(orderId);
        assertEq(uint256(order.status), uint256(SimpleEscrow.OrderStatus.Cancelled));

        // Check buyer received refund
        assertEq(usdc.balanceOf(buyer), buyerBalanceBefore + ORDER_AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_Cancel_RevertIfNotBuyer() public {
        uint256 deadline = block.timestamp + 7 days;

        vm.prank(buyer);
        escrow.createOrder(orderId, seller, address(usdc), ORDER_AMOUNT, deadline);

        vm.prank(seller);
        vm.expectRevert(SimpleEscrow.Unauthorized.selector);
        escrow.cancel(orderId);
    }

    // ============ Auto Complete Tests ============

    function test_AutoComplete() public {
        uint256 deadline = block.timestamp + 7 days;

        vm.prank(buyer);
        escrow.createOrder(orderId, seller, address(usdc), ORDER_AMOUNT, deadline);

        // Fast forward past deadline
        vm.warp(deadline + 1);

        uint256 sellerBalanceBefore = usdc.balanceOf(seller);

        // Anyone can call autoComplete
        escrow.autoComplete(orderId);

        SimpleEscrow.Order memory order = escrow.getOrder(orderId);
        assertEq(uint256(order.status), uint256(SimpleEscrow.OrderStatus.Completed));

        assertEq(usdc.balanceOf(seller), sellerBalanceBefore + ORDER_AMOUNT);
    }

    function test_AutoComplete_RevertIfDeadlineNotReached() public {
        uint256 deadline = block.timestamp + 7 days;

        vm.prank(buyer);
        escrow.createOrder(orderId, seller, address(usdc), ORDER_AMOUNT, deadline);

        vm.expectRevert(SimpleEscrow.DeadlineNotReached.selector);
        escrow.autoComplete(orderId);
    }

    // ============ Admin Tests ============

    function test_SetSupportedToken() public {
        address newToken = address(100);

        vm.prank(owner);
        escrow.setSupportedToken(newToken, true);

        assertTrue(escrow.isTokenSupported(newToken));

        vm.prank(owner);
        escrow.setSupportedToken(newToken, false);

        assertFalse(escrow.isTokenSupported(newToken));
    }

    function test_SetSupportedToken_RevertIfNotOwner() public {
        address newToken = address(100);

        vm.prank(buyer);
        vm.expectRevert(SimpleEscrow.Unauthorized.selector);
        escrow.setSupportedToken(newToken, true);
    }

    function test_TransferOwnership() public {
        address newOwner = address(100);

        vm.prank(owner);
        escrow.transferOwnership(newOwner);

        assertEq(escrow.owner(), newOwner);
    }
}
