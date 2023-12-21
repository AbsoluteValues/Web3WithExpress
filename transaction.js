const { Web3 } = require("web3"); // web3 모듈 불러오기
const { ETH_DATA_FORMAT, DEFAULT_RETURN_FORMAT } = require("web3"); // web3에서 ETH_DATA_FORMAT을 불러오기
const db = require('./db.js');

require("dotenv").config(); // dotenv 모듈 config 불러오기

let debounce = false;

async function sendTransactionsAPI(_from, _to, _amount, _repeat, _callback) {

    const txLink = [];
    debounce = false;

    async function main(count) {

        // 이더리움 네트워크의 노드 연결을 위한 설정
        const network = process.env.ETHEREUM_NETWORK; // .env로 기록한 ETHEREUM_NETWORK 변수 값 가져오고 변수로 지정하기
        const web3 = new Web3(
            new Web3.providers.HttpProvider(
                `https://${network}.infura.io/v3/${process.env.INFURA_API_KEY}`,
            ),
        );

        // 개인키로부터 서명 계정 생성하기
        const signer = web3.eth.accounts.privateKeyToAccount(
            _from,
        );

        // 이더리움 계정 지갑에 서명자 추가하기
        web3.eth.accounts.wallet.add(signer);

        // 예상 가스 비용 계산하기
        await web3.eth
            .estimateGas( // web3 모듈의 예상 가스 비용 계산 함수 호출하기
                {
                    from: signer.address, // 전송할 지갑 주소
                    to: _to, // 수신할 지갑 주소
                    value: web3.utils.toWei(_amount, "ether"), // 단위를 변환해주기 위한 함수(wei는 Ether의 가장 작은 하위 단위며 1 Ehter = 10^18 Wei 이다.)
                },
                "latest", // 현재 블록 상태를 기준으로 하기
                ETH_DATA_FORMAT, // 이더리움 데이터 형식
            )
            .then((value) => { // 콜백 함수
                limit = value; // 계산한 가스 비용을 변수로 지정하기 
            });

        const _nonce = await web3.eth.getTransactionCount(signer.address) + BigInt(count);

        // 트랜잭션 생성하고 정의하기
        const tx = {
            from: signer.address, // 이더를 전송할 지갑 주소 설정하기
            to: _to, // 이더를 수신할 지갑 주소 설정하기
            value: web3.utils.toWei(_amount, "ether"), // 전송할 이더의 양 설정하기
            gas: limit, // 가스를 예상 가스 한도만큼 지정하기
            nonce: _nonce, // 이중 지불을 방지하기 위한 일종의 일련번호 설정하기(거래 전송시 1씩 증가, 계정에서 유일하며, 동일한 논스는 존재하지 않는다.)
            maxPriorityFeePerGas: web3.utils.toWei("3", "gwei"), // 이더리움 EIP-1559에서 사용되는 최대 우선 순위 수수료 설정하기
            maxFeePerGas: web3.utils.toWei("10", "gwei"), // 이더리움 EIP-1559에서 사용되는 최대 가스당 최대 수수료 설정하기
            chainId: 11155111, // 이더리움 네트워크의 체인 아이디 설정하기
            type: 0x2, // EIP-1559 트랙잭션 유형으로 설정하기
        };

        const signedTx = await web3.eth.accounts.signTransaction(tx, signer.privateKey); // 생성된 트랜잭션에 서명하고 변수로 지정하기

        console.log("Raw transaction data: " + signedTx.rawTransaction); // 암호화된 트랙잭션 데이터 출력하기

        // 이더리움 네트워크에 트랜잭션 전송하기
        const receipt = await web3.eth
            .sendSignedTransaction(signedTx.rawTransaction) // 서명된 트랙잭션 전송하기
            .once("transactionHash", (txhash) => {
                console.log(`Mining transaction ...`); // 처리 중임을 출력하기
                txLink.push(`https://${network}.etherscan.io/tx/${txhash}`);
                console.log(`https://${network}.etherscan.io/tx/${txhash}`); // 트랜잭션 진행도를 살펴볼 수 있는 이더리움 세폴리아 테스트넷의 트랜잭션 정보 링크 출력하기
            });

        console.log(`Mined in block ${receipt.blockNumber}`); // 트랙잭션이 담기는 블록 번호 출력하기

        if (txLink.length == _repeat && debounce == false) {
            debounce = true;
            _callback(txLink);
        }
    }

    const util = require('util');
    const query = util.promisify(db.query).bind(db);
    const beginTransaction = util.promisify(db.beginTransaction).bind(db);
    const commit = util.promisify(db.commit).bind(db);
    const rollback = util.promisify(db.rollback).bind(db);

    async function resetNonce() {
        try {
            await query('UPDATE nonce SET nonce = 1');
        } catch (error) {
            throw error;
        }
    }

    async function selectNonce() {
        try {
            const selectResults = await query('SELECT * FROM nonce FOR UPDATE');
            return selectResults[0].nonce;
        } catch (error) {
            throw error;
        }
    }

    async function updateNonce(nonce) {
        try {
            await query('UPDATE nonce SET nonce = ?', [nonce]);
        } catch (error) {
            throw error;
        }
    }

    async function sendTransaction() {
        try {
            const nonce = await selectNonce();

            for (let i = nonce - 1; i < _repeat; i++) {
                await updateNonce(i + 1);
                main(i);

                if (i === _repeat - 1) {
                    await commit();
                }
            }
        } catch (error) {
            await rollback();
            throw error;
        }
    }

    async function startTransaction() {
        try {
            await beginTransaction();
            await resetNonce();
            await sendTransaction();
        } catch (error) {
            throw error;
        }
    }

    // 트랜잭션 시작
    startTransaction();

    // 가독성 개선 이전의 원본 코드
    /*
    db.query('UPDATE nonce SET nonce = 1', async function (error, results, fields) {
        if (error) throw error;
    });

    function sendTransactions() {
        db.query('SELECT * FROM nonce FOR UPDATE', async function (error, selectResults, fields) {
            if (error) throw error;

            db.query('UPDATE nonce SET nonce = nonce + 1', async function (error, updateResults, fields) {
                if (error) {
                    db.rollback();
                } else {
                    main(selectResults[0].nonce - 1);

                    if (selectResults[0].nonce == _repeat) {
                        db.commit();
                    } else {
                        sendTransactions(); // Recursive call to continue the loop
                    }
                }
            });
        });
    }

    db.beginTransaction((error) => {
        if (error) throw error;

        sendTransactions(); // 반복 시작
    });
    */
}

module.exports = {
    sendTransactionsAPI
}
