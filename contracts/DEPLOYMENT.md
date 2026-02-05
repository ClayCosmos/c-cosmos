# ClayCosmos 合约部署指南

本文档记录了 SimpleEscrow 合约的完整部署流程。

## 目录

- [环境准备](#环境准备)
- [配置](#配置)
- [获取测试 ETH](#获取测试-eth)
- [部署合约](#部署合约)
- [更新服务器配置](#更新服务器配置)
- [合约使用](#合约使用)

---

## 环境准备

### 1. 安装 Foundry

```bash
# 安装 Foundry
curl -L https://foundry.paradigm.xyz | bash

# 加载环境
source ~/.zshenv

# 安装工具链
foundryup

# 验证安装
forge --version
```

### 2. 安装依赖

```bash
cd contracts
forge install foundry-rs/forge-std
```

---

## 配置

### 1. 创建环境文件

```bash
cp .env.example .env
```

### 2. 配置 .env

```bash
# RPC URLs
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_MAINNET_RPC_URL=https://mainnet.base.org

# Basescan API Key (用于合约验证)
# 获取地址: https://basescan.org/myapikey
BASESCAN_API_KEY=你的_basescan_api_key

# 部署钱包私钥 (带 0x 前缀)
# 从 MetaMask 导出: 账户详情 → 显示私钥
PRIVATE_KEY=0x你的64位私钥
```

### 3. 获取 BASESCAN_API_KEY

1. 访问 https://basescan.org/
2. 注册/登录账户
3. 进入 https://basescan.org/myapikey
4. 点击 "Add" 创建新的 API Key
5. 复制 API Key 到 `.env`

### 4. 获取 PRIVATE_KEY

1. 打开 MetaMask
2. 点击账户名右边的 `⋮`
3. 选择「账户详情」
4. 点击「显示私钥」
5. 输入密码确认
6. 复制 64 位 hex 字符串，加上 `0x` 前缀

**安全提醒：**
- 建议创建专门用于部署的新钱包
- 只存入部署所需的少量 ETH
- **永远不要把私钥提交到 Git**

### 5. 验证钱包地址

```bash
source .env
cast wallet address $PRIVATE_KEY
```

---

## 获取测试 ETH

部署到 Base Sepolia 测试网需要测试 ETH 作为 Gas 费。

### 水龙头列表

| 水龙头 | 链接 | 备注 |
|--------|------|------|
| Coinbase Faucet | https://portal.cdp.coinbase.com/products/faucet | 推荐，每天 0.0001 ETH |
| Superchain Faucet | https://app.optimism.io/faucet | 需要 GitHub 账号 |
| Alchemy Faucet | https://www.alchemy.com/faucets/base-sepolia | 需要 Alchemy 账号 |

### 使用 Coinbase Faucet

1. 访问 https://portal.cdp.coinbase.com/products/faucet
2. 登录 Coinbase 账号
3. 选择 Network: **Base Sepolia**
4. 选择 Token: **ETH**
5. 输入钱包地址
6. 点击 "Claim"

部署只需约 **0.000002 ETH**，0.0001 ETH 足够多次部署。

---

## 部署合约

### 1. 编译

```bash
cd contracts
forge build
```

### 2. 运行测试

```bash
forge test
forge test -vvv  # 详细输出
```

### 3. 部署到 Base Sepolia (测试网)

```bash
source .env
forge script script/Deploy.s.sol:DeployScript \
    --rpc-url $BASE_SEPOLIA_RPC_URL \
    --broadcast \
    --verify
```

### 4. 部署到 Base Mainnet (主网)

```bash
source .env
forge script script/Deploy.s.sol:DeployScript \
    --rpc-url $BASE_MAINNET_RPC_URL \
    --broadcast \
    --verify
```

### 5. 部署输出示例

```
== Logs ==
  Deployer address: 0xEfaDD8D2B79562132De0Fe307Aa7A0a2eA76f688
  SimpleEscrow deployed at: 0xcB2CEB939e955a28c9d4ADC0358C0B959F5ec9ce
  Chain: Base Sepolia
  USDC enabled: 0x036CbD53842c5426634e7929541eC2318f3dCF7e

  === Deployment Summary ===
  Chain ID: 84532
  Escrow: 0xcB2CEB939e955a28c9d4ADC0358C0B959F5ec9ce
  Owner: 0xEfaDD8D2B79562132De0Fe307Aa7A0a2eA76f688
  Fee Recipient: 0xEfaDD8D2B79562132De0Fe307Aa7A0a2eA76f688
  Fee Rate (bps): 150
  USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### 6. 平台手续费

合约部署时设置了 1.5% 的促销费率（默认费率为 3%）。

| 参数 | 值 |
|------|-----|
| 费率 | 150 bps (1.5%) |
| 最大费率 | 1000 bps (10%) |
| 收款地址 | 与部署者相同 |

费率可通过 `setFeeRate` 函数调整，收款地址可通过 `setFeeRecipient` 函数修改。

---

## 更新服务器配置

部署成功后，需要更新服务器中的合约地址。

### 修改 `server/internal/handler/order.go`

```go
// Contract addresses
const (
    EscrowContractBaseSepolia = "0xcB2CEB939e955a28c9d4ADC0358C0B959F5ec9ce"
    EscrowContractBaseMainnet = "0x..." // 主网部署后更新
    DefaultDeadlineDays       = 7
)
```

---

## 合约使用

### 当前部署信息 (Base Sepolia)

| 项目 | 值 |
|------|-----|
| 合约地址 | `0xcB2CEB939e955a28c9d4ADC0358C0B959F5ec9ce` |
| 网络 | Base Sepolia (Chain ID: 84532) |
| Owner | `0xEfaDD8D2B79562132De0Fe307Aa7A0a2eA76f688` |
| 费率 | 150 bps (1.5% 促销费率) |
| 收款地址 | `0xEfaDD8D2B79562132De0Fe307Aa7A0a2eA76f688` |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Basescan | https://sepolia.basescan.org/address/0xcb2ceb939e955a28c9d4adc0358c0b959f5ec9ce |

### 交易流程

```
┌─────────┐                    ┌──────────┐                    ┌────────┐
│  Buyer  │                    │  Escrow  │                    │ Seller │
└────┬────┘                    └────┬─────┘                    └───┬────┘
     │                              │                              │
     │  1. createOrder (锁定USDC)   │                              │
     │─────────────────────────────>│                              │
     │                              │                              │
     │  2. 平台通知卖家发货          │                              │
     │──────────────────────────────│─────────────────────────────>│
     │                              │                              │
     │                              │  3. 卖家通过API确认发货        │
     │                              │<─────────────────────────────│
     │                              │                              │
     │  4. complete (确认收货)      │                              │
     │─────────────────────────────>│  5. 转账给卖家 (扣除手续费)   │
     │                              │─────────────────────────────>│
```

### 合约函数

| 函数 | 调用者 | 说明 |
|------|--------|------|
| `createOrder(orderId, seller, token, amount, deadline)` | Buyer | 创建订单，锁定 USDC |
| `complete(orderId)` | Buyer | 确认收货，释放资金给卖家 |
| `cancel(orderId)` | Buyer | 取消订单，退款 |
| `autoComplete(orderId)` | Anyone | 超时后自动完成（释放资金给卖家） |
| `getOrder(orderId)` | Anyone | 查询订单信息 |
| `setFeeRate(feeRate)` | Owner | 设置手续费率（basis points） |
| `setFeeRecipient(recipient)` | Owner | 设置手续费收款地址 |

### USDC 地址

| 网络 | USDC 地址 |
|------|-----------|
| Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Base Mainnet | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

### 获取测试 USDC

测试网 USDC 可从 Circle 水龙头获取:
https://faucet.circle.com/

---

## 常见问题

### Q: 部署时报错 "insufficient funds"

A: 部署钱包没有 ETH。从水龙头获取测试 ETH。

### Q: 部署时报错 "Source not found: forge-std"

A: 需要安装依赖：
```bash
forge install foundry-rs/forge-std
```

### Q: 私钥格式错误

A: 私钥需要带 `0x` 前缀：
```
PRIVATE_KEY=0x1234...abcd
```

### Q: 如何验证钱包地址对应的私钥

```bash
cast wallet address $PRIVATE_KEY
```

### Q: 部署到不同地址

每次部署都会生成新的合约地址。如果需要重新部署，新地址会不同，需要再次更新服务器配置。

---

## 部署记录

| 日期 | 网络 | 合约地址 | 部署者 |
|------|------|----------|--------|
| 2026-02-05 | Base Sepolia | `0xcB2CEB939e955a28c9d4ADC0358C0B959F5ec9ce` | `0xEfaDD8D2B79562132De0Fe307Aa7A0a2eA76f688` |
