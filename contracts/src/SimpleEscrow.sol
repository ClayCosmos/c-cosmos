// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./interfaces/IERC20.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";

/// @title SimpleEscrow - ClayCosmos MVP Escrow Contract
/// @notice A simple escrow contract for AI Agent trading on Base
/// @dev MVP version without upgradability
contract SimpleEscrow is ReentrancyGuard {
    // ============ Enums ============

    enum OrderStatus {
        None,       // 0: Order does not exist
        Created,    // 1: Funds locked, awaiting delivery
        Completed,  // 2: Buyer confirmed, funds released
        Cancelled   // 3: Order cancelled, funds returned
    }

    // ============ Structs ============

    struct Order {
        address buyer;
        address seller;
        address token;
        uint256 amount;
        uint256 deadline;       // Auto-complete deadline
        OrderStatus status;
        uint256 createdAt;
    }

    // ============ State Variables ============

    mapping(bytes32 => Order) public orders;
    mapping(address => bool) public supportedTokens;
    address public owner;
    address public feeRecipient;
    uint256 public feeRate; // in basis points (100 = 1%, max 1000 = 10%)

    uint256 public constant MIN_DEADLINE = 1 hours;
    uint256 public constant MAX_DEADLINE = 30 days;
    uint256 public constant MAX_FEE_RATE = 1000; // 10%

    // ============ Events ============

    event OrderCreated(
        bytes32 indexed orderId,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 amount,
        uint256 deadline
    );
    event OrderCompleted(bytes32 indexed orderId, uint256 amount);
    event OrderCancelled(bytes32 indexed orderId, uint256 amount);
    event TokenUpdated(address indexed token, bool supported);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event FeeUpdated(uint256 oldRate, uint256 newRate);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    // ============ Errors ============

    error OrderAlreadyExists();
    error OrderNotFound();
    error InvalidStatus();
    error Unauthorized();
    error InvalidAmount();
    error InvalidDeadline();
    error UnsupportedToken();
    error DeadlineNotReached();
    error TransferFailed();
    error InvalidFeeRate();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ============ Constructor ============

    constructor(address _owner, address _feeRecipient, uint256 _feeRate) {
        if (_feeRate > MAX_FEE_RATE) revert InvalidFeeRate();
        owner = _owner;
        feeRecipient = _feeRecipient;
        feeRate = _feeRate;
        emit OwnershipTransferred(address(0), _owner);
    }

    // ============ Buyer Functions ============

    /// @notice Create an order and lock funds in escrow
    /// @param orderId Unique order identifier (generated off-chain)
    /// @param seller Seller's wallet address
    /// @param token ERC20 token address (USDC)
    /// @param amount Amount to lock
    /// @param deadline Auto-complete deadline timestamp
    function createOrder(
        bytes32 orderId,
        address seller,
        address token,
        uint256 amount,
        uint256 deadline
    ) external nonReentrant {
        if (orders[orderId].status != OrderStatus.None) revert OrderAlreadyExists();
        if (!supportedTokens[token]) revert UnsupportedToken();
        if (amount == 0) revert InvalidAmount();
        if (seller == address(0)) revert InvalidAmount();
        if (deadline < block.timestamp + MIN_DEADLINE) revert InvalidDeadline();
        if (deadline > block.timestamp + MAX_DEADLINE) revert InvalidDeadline();

        orders[orderId] = Order({
            buyer: msg.sender,
            seller: seller,
            token: token,
            amount: amount,
            deadline: deadline,
            status: OrderStatus.Created,
            createdAt: block.timestamp
        });

        // Transfer funds from buyer to contract
        bool success = IERC20(token).transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        emit OrderCreated(orderId, msg.sender, seller, token, amount, deadline);
    }

    /// @notice Buyer confirms receipt and releases funds to seller
    /// @param orderId Order identifier
    function complete(bytes32 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.status == OrderStatus.None) revert OrderNotFound();
        if (order.buyer != msg.sender) revert Unauthorized();
        if (order.status != OrderStatus.Created) revert InvalidStatus();

        _completeOrder(orderId, order);
    }

    /// @notice Buyer cancels order before delivery (refund)
    /// @param orderId Order identifier
    function cancel(bytes32 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.status == OrderStatus.None) revert OrderNotFound();
        if (order.buyer != msg.sender) revert Unauthorized();
        if (order.status != OrderStatus.Created) revert InvalidStatus();

        order.status = OrderStatus.Cancelled;

        // Refund buyer
        bool success = IERC20(order.token).transfer(order.buyer, order.amount);
        if (!success) revert TransferFailed();

        emit OrderCancelled(orderId, order.amount);
    }

    // ============ Public Functions ============

    /// @notice Auto-complete order after deadline (anyone can call)
    /// @param orderId Order identifier
    function autoComplete(bytes32 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.status == OrderStatus.None) revert OrderNotFound();
        if (order.status != OrderStatus.Created) revert InvalidStatus();
        if (block.timestamp < order.deadline) revert DeadlineNotReached();

        _completeOrder(orderId, order);
    }

    // ============ Admin Functions ============

    /// @notice Add or remove supported token
    /// @param token Token address
    /// @param supported Whether to support this token
    function setSupportedToken(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
        emit TokenUpdated(token, supported);
    }

    /// @notice Set fee rate (in basis points)
    /// @param _feeRate New fee rate (max 1000 = 10%)
    function setFeeRate(uint256 _feeRate) external onlyOwner {
        if (_feeRate > MAX_FEE_RATE) revert InvalidFeeRate();
        emit FeeUpdated(feeRate, _feeRate);
        feeRate = _feeRate;
    }

    /// @notice Set fee recipient address
    /// @param _feeRecipient New fee recipient
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        emit FeeRecipientUpdated(feeRecipient, _feeRecipient);
        feeRecipient = _feeRecipient;
    }

    /// @notice Transfer ownership
    /// @param newOwner New owner address
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAmount();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ============ Internal Functions ============

    function _completeOrder(bytes32 orderId, Order storage order) internal {
        order.status = OrderStatus.Completed;

        uint256 fee = (order.amount * feeRate) / 10000;
        uint256 sellerAmount = order.amount - fee;

        // Transfer funds to seller
        bool success = IERC20(order.token).transfer(order.seller, sellerAmount);
        if (!success) revert TransferFailed();

        // Transfer fee to platform
        if (fee > 0) {
            success = IERC20(order.token).transfer(feeRecipient, fee);
            if (!success) revert TransferFailed();
        }

        emit OrderCompleted(orderId, order.amount);
    }

    // ============ View Functions ============

    /// @notice Get order details
    /// @param orderId Order identifier
    /// @return Order struct
    function getOrder(bytes32 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    /// @notice Check if token is supported
    /// @param token Token address
    /// @return Whether token is supported
    function isTokenSupported(address token) external view returns (bool) {
        return supportedTokens[token];
    }
}
