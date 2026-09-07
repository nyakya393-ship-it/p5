// =========================================================
// Splatoon 3 Weapon Analyzer
// Lazy Loading + IndexedDB Cache
// =========================================================


const READER_API = "https://r.jina.ai/";

const DB_NAME =
    "splatoon3_weapon_analyzer";

const DB_VERSION = 1;

const STORE_NAME = "weapons";


let db = null;

let categories = [];

let weapons = [];

let currentCategory =
    "すべて";

let currentWeapon =
    null;


// =========================================================
// DOM
// =========================================================

const $ = selector =>
    document.querySelector(
        selector
    );


const weaponList =
    $("#weaponList");

const detail =
    $("#detail");

const categoriesElement =
    $("#categories");

const searchInput =
    $("#search");

const weaponCount =
    $("#weaponCount");

const dataStatus =
    $("#dataStatus");


// =========================================================
// IndexedDB
// =========================================================

function openDatabase(){

    return new Promise(
        (resolve, reject) => {

            const request =
                indexedDB.open(
                    DB_NAME,
                    DB_VERSION
                );


            request.onupgradeneeded =
                event => {

                    const database =
                        event.target.result;


                    if(
                        !database
                            .objectStoreNames
                            .contains(
                                STORE_NAME
                            )
                    ){

                        database
                            .createObjectStore(
                                STORE_NAME,
                                {
                                    keyPath:"id"
                                }
                            );

                    }

                };


            request.onsuccess =
                () => {

                    db =
                        request.result;

                    resolve(db);

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


function getCachedWeapon(
    id
){

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readonly"
                );


            const store =
                transaction
                    .objectStore(
                        STORE_NAME
                    );


            const request =
                store.get(id);


            request.onsuccess =
                () => {

                    resolve(
                        request.result ||
                        null
                    );

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


function saveCachedWeapon(
    weapon
){

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );


            const store =
                transaction
                    .objectStore(
                        STORE_NAME
                    );


            const request =
                store.put(
                    weapon
                );


            request.onsuccess =
                () => {

                    resolve();

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


function deleteCachedWeapon(
    id
){

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );


            const store =
                transaction
                    .objectStore(
                        STORE_NAME
                    );


            const request =
                store.delete(
                    id
                );


            request.onsuccess =
                () => {

                    resolve();

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


function getAllCachedWeapons(){

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readonly"
                );


            const store =
                transaction
                    .objectStore(
                        STORE_NAME
                    );


            const request =
                store.getAll();


            request.onsuccess =
                () => {

                    resolve(
                        request.result ||
                        []
                    );

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


// =========================================================
// Utilities
// =========================================================

function clean(
    value
){

    if(
        !value
    ){
        return "";
    }

    return String(value)
        .replace(
            /\u00a0/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();

}


function normalize(
    value
){

    return clean(value)
        .replace(
            /\s/g,
            ""
        )
        .toLowerCase();

}


function escapeHTML(
    value
){

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


function firstNumber(
    value
){

    if(
        !value
    ){
        return null;
    }

    const match =
        String(value)
            .replaceAll(
                ",",
                ""
            )
            .match(
                /-?\d+(?:\.\d+)?/
            );


    if(
        !match
    ){
        return null;
    }

    return Number(
        match[0]
    );

}


function numberRange(
    value
){

    if(
        !value
    ){

        return {
            max:null,
            min:null
        };

    }


    const numbers =
        String(value)
            .replaceAll(
                ",",
                ""
            )
            .match(
                /-?\d+(?:\.\d+)?/g
            );


    if(
        !numbers ||
        numbers.length === 0
    ){

        return {
            max:null,
            min:null
        };

    }


    const values =
        numbers.map(
            Number
        );


    if(
        values.length === 1
    ){

        return {
            max:values[0],
            min:values[0]
        };

    }


    return {
        max:Math.max(
            values[0],
            values[1]
        ),

        min:Math.min(
            values[0],
            values[1]
        )
    };

}


function formatNumber(
    value
){

    if(
        value === null ||
        value === undefined ||
        value === ""
    ){
        return "—";
    }


    if(
        typeof value === "number" &&
        Number.isInteger(value)
    ){

        return String(value);

    }


    return String(value);

}


// =========================================================
// Reader
// =========================================================

async function fetchWikiPage(
    url
){

    const endpoint =
        READER_API +
        url;


    const response =
        await fetch(
            endpoint,
            {
                method:"GET",

                headers:{
                    Accept:"text/plain"
                },

                cache:"no-store"
            }
        );


    if(
        !response.ok
    ){

        throw new Error(
            `データ取得失敗 (${response.status})`
        );

    }


    return await response.text();

}


// =========================================================
// Category loading
// =========================================================

async function loadCategories(){

    const response =
        await fetch(
            "data/categories.json?" +
            Date.now()
        );


    if(
        !response.ok
    ){

        throw new Error(
            "categories.jsonを読み込めませんでした"
        );

    }


    const data =
        await response.json();


    categories =
        data.categories ||
        [];


    renderCategories();

    await discoverWeapons();

}


// =========================================================
// Weapon discovery
// =========================================================

async function discoverWeapons(){

    const discovered =
        new Map();


    dataStatus.textContent =
        "ブキ一覧を取得中…";


    for(
        const category of categories
    ){

        try{

            const text =
                await fetchWikiPage(
                    category.url
                );


            const links =
                extractWeaponLinks(
                    text
                );


            for(
                const link of links
            ){

                const id =
                    createWeaponId(
                        link.name
                    );


                if(
                    !discovered.has(
                        id
                    )
                ){

                    discovered.set(
                        id,
                        {
                            id:id,

                            name:
                                link.name,

                            category:
                                category.name,

                            url:
                                link.url,

                            cached:false
                        }
                    );

                }

            }


        }catch(error){

            console.error(
                category.name,
                error
            );

        }

    }


    weapons =
        Array.from(
            discovered.values()
        );


    const cached =
        await getAllCachedWeapons();


    const cachedMap =
        new Map(
            cached.map(
                item => [
                    item.id,
                    item
                ]
            )
        );


    for(
        const weapon of weapons
    ){

        weapon.cached =
            cachedMap.has(
                weapon.id
            );

    }


    renderWeaponList();


    dataStatus.textContent =
        `${weapons.length}種類のブキ`;

}


// =========================================================
// Extract links
// =========================================================

function extractWeaponLinks(
    text
){

    const result = [];

    const seen =
        new Set();


    const markdownRegex =
        /\[([^\]]+)\]\((https:\/\/wikiwiki\.jp\/splatoon3mix\/[^)\s]+)\)/g;


    let match;


    while(
        (
            match =
                markdownRegex.exec(
                    text
                )
        ) !== null
    ){

        const name =
            clean(
                match[1]
            );


        const url =
            decodeURIComponent(
                match[2]
            );


        if(
            !isWeaponPage(
                url
            )
        ){
            continue;
        }


        const key =
            normalize(
                url
            );


        if(
            seen.has(key)
        ){
            continue;
        }


        seen.add(key);


        result.push({
            name:name,
            url:url
        });

    }


    return result;

}


// =========================================================
// Check weapon page
// =========================================================

function isWeaponPage(
    url
){

    try{

        const parsed =
            new URL(
                url
            );


        if(
            parsed.hostname !==
            "wikiwiki.jp"
        ){

            return false;

        }


        const path =
            decodeURIComponent(
                parsed.pathname
            );


        if(
            !path.startsWith(
                "/splatoon3mix/ブキ/"
            )
        ){

            return false;

        }


        const name =
            path.split(
                "/"
            ).pop();


        const excluded = [

            "ブキ",

            "ブキ性能",

            "比較",

            "シューター属",

            "ブラスター属",

            "ローラー属",

            "フデ属",

            "チャージャー属",

            "スロッシャー属",

            "スピナー属",

            "マニューバー属",

            "シェルター属",

            "ストリンガー属",

            "ワイパー属"

        ];


        if(
            excluded.includes(
                name
            )
        ){

            return false;

        }


        return true;


    }catch{

        return false;

    }

}


// =========================================================
// ID
// =========================================================

function createWeaponId(
    name
){

    return normalize(
        name
    )
        .replace(
            /[^a-z0-9ぁ-んァ-ヶ一-龠_-]/gi,
            "-"
        )
        .replace(
            /-+/g,
            "-"
        );

}


// =========================================================
// Parse weapon
// =========================================================

function parseWeaponPage(
    text,
    baseWeapon
){

    const lines =
        text
            .split("\n")
            .map(clean)
            .filter(Boolean);


    function findLine(
        ...labels
    ){

        for(
            const line of lines
        ){

            const normalized =
                normalize(
                    line
                );


            for(
                const label of labels
            ){

                const target =
                    normalize(
                        label
                    );


                if(
                    normalized.startsWith(
                        target
                    )
                ){

                    let value =
                        line.substring(
                            label.length
                        );


                    value =
                        value
                            .replace(
                                /^[：:\s|]+/,
                                ""
                            )
                            .trim();


                    if(
                        value
                    ){

                        return value;

                    }

                }

            }

        }


        return "";

    }


    const sub =
        findLine(
            "サブウェポン",
            "サブ"
        );


    const special =
        findLine(
            "スペシャルウェポン",
            "スペシャル"
        );


    const pointsRaw =
        findLine(
            "必要ポイント",
            "スペシャル必要ポイント"
        );


    const weight =
        findLine(
            "ブキ重量",
            "重量"
        );


    const effectiveRaw =
        findLine(
            "有効射程"
        );


    const paintRaw =
        findLine(
            "塗り射程"
        );


    const damageRaw =
        findLine(
            "ダメージ"
        );


    const killsRaw =
        findLine(
            "確定数"
        );


    const killTimeRaw =
        findLine(
            "キルタイム"
        );


    const fireFrameRaw =
        findLine(
            "連射フレーム",
            "発射フレーム"
        );


    const shotsRaw =
        findLine(
            "秒間発射数"
        );


    const dpsRaw =
        findLine(
            "DPS"
        );


    const spreadRaw =
        findLine(
            "拡散"
        );


    const jumpSpreadRaw =
        findLine(
            "ジャンプ中拡散"
        );


    const reticleRaw =
        findLine(
            "レティクル反応距離"
        );


    const blastRadiusRaw =
        findLine(
            "爆風半径",
            "爆風範囲"
        );


    const blastDamageRaw =
        findLine(
            "爆風ダメージ"
        );


    const directDamageRaw =
        findLine(
            "直撃ダメージ",
            "直接ダメージ"
        );


    const damageRangeRaw =
        findLine(
            "ダメージ射程",
            "爆風射程"
        );


    const effective =
        numberRange(
            effectiveRaw
        );


    const paint =
        numberRange(
            paintRaw
        );


    const damage =
        numberRange(
            damageRaw
        );


    const damageRange =
        numberRange(
            damageRangeRaw
        );


    let directDamage =
        firstNumber(
            directDamageRaw
        );


    if(
        directDamage === null &&
        damage.max !== null
    ){

        directDamage =
            damage.max;

    }


    const blastDamage =
        firstNumber(
            blastDamageRaw
        );


    const blastRadius =
        firstNumber(
            blastRadiusRaw
        );


    let blastRange =
        damageRange.max;


    if(
        blastRange === null &&
        blastRadius !== null &&
        effective.max !== null
    ){

        blastRange =
            effective.max +
            blastRadius;

    }


    return {

        id:
            baseWeapon.id,

        name:
            baseWeapon.name,

        category:
            baseWeapon.category,

        url:
            baseWeapon.url,

        cachedAt:
            Date.now(),

        sub:
            sub || "不明",

        special:
            special || "不明",

        specialPoints:
            firstNumber(
                pointsRaw
            ),

        specialPointsRaw:
            pointsRaw,

        weight:
            weight,

        range:{

            effective:
                effective.max,

            paint:
                paint.max,

            reticle:
                firstNumber(
                    reticleRaw
                ),

            blast:
                blastRange

        },

        damage:{

            max:
                damage.max,

            min:
                damage.min,

            direct:
                directDamage,

            blast:
                blastDamage

        },

        kills:
            killsRaw,

        killTime:
            firstNumber(
                killTimeRaw
            ),

        fireFrame:
            firstNumber(
                fireFrameRaw
            ),

        fireRateRaw:
            fireFrameRaw,

        shotsPerSecond:
            firstNumber(
                shotsRaw
            ),

        dps:
            firstNumber(
                dpsRaw
            ),

        spread:
            firstNumber(
                spreadRaw
            ),

        jumpSpread:
            firstNumber(
                jumpSpreadRaw
            ),

        blast:{

            range:
                blastRange,

            radius:
                blastRadius

        },

        source:
            baseWeapon.url,

        sourceName:
            "WikiWiki - Splatoon3 Wiki"

    };

}


// =========================================================
// Select weapon
// =========================================================

async function selectWeapon(
    id
){

    const weapon =
        weapons.find(
            item =>
                item.id === id
        );


    if(
        !weapon
    ){
        return;
    }


    currentWeapon =
        weapon;


    renderLoading(
        weapon.name
    );


    renderWeaponList();


    try{

        const cached =
            await getCachedWeapon(
                weapon.id
            );


        if(
            cached
        ){

            renderWeapon(
                cached,
                true
            );

            dataStatus.textContent =
                `${weapons.length}種類のブキ`;

            return;

        }


        dataStatus.textContent =
            `${weapon.name}を取得中…`;


        const text =
            await fetchWikiPage(
                weapon.url
            );


        const parsed =
            parseWeaponPage(
                text,
                weapon
            );


        await saveCachedWeapon(
            parsed
        );


        weapon.cached =
            true;


        renderWeapon(
            parsed,
            false
        );


        dataStatus.textContent =
            `${weapons.length}種類のブキ`;


    }catch(error){

        console.error(
            error
        );


        renderError(
            weapon,
            error
        );

    }

}


// =========================================================
// Categories UI
// =========================================================

function renderCategories(){

    categoriesElement.innerHTML =
        "";


    createCategoryButton(
        "すべて",
        "すべて"
    );


    for(
        const category of categories
    ){

        createCategoryButton(
            category.name,
            category.name
        );

    }

}


function createCategoryButton(
    label,
    value
){

    const button =
        document.createElement(
            "button"
        );


    button.type =
        "button";


    button.className =
        "category-button";


    if(
        currentCategory ===
        value
    ){

        button.classList.add(
            "active"
        );

    }


    button.textContent =
        label;


    button.addEventListener(
        "click",
        () => {

            currentCategory =
                value;


            renderCategories();

            renderWeaponList();

        }
    );


    categoriesElement.appendChild(
        button
    );

}


// =========================================================
// Weapon list
// =========================================================

function renderWeaponList(){

    const keyword =
        normalize(
            searchInput.value
        );


    const filtered =
        weapons.filter(
            weapon => {

                const categoryOK =
                    currentCategory ===
                    "すべて"
                    ||
                    weapon.category ===
                    currentCategory;


                const searchOK =
                    !keyword
                    ||
                    normalize(
                        weapon.name
                    ).includes(
                        keyword
                    );


                return (
                    categoryOK &&
                    searchOK
                );

            }
        );


    weaponCount.textContent =
        filtered.length;


    weaponList.innerHTML =
        "";


    if(
        filtered.length === 0
    ){

        weaponList.innerHTML =
            `
            <div class="empty">
                ブキが見つかりません
            </div>
            `;

        return;

    }


    for(
        const weapon of filtered
    ){

        const button =
            document.createElement(
                "button"
            );


        button.type =
            "button";


        button.className =
            "weapon-button";


        if(
            currentWeapon &&
            currentWeapon.id ===
            weapon.id
        ){

            button.classList.add(
                "active"
            );

        }


        button.innerHTML =
            `
            <span class="weapon-name">
                ${escapeHTML(
                    weapon.name
                )}
            </span>

            <span class="weapon-meta">

                ${escapeHTML(
                    weapon.category
                )}

                ${
                    weapon.cached
                        ? "・保存済み"
                        : ""
                }

            </span>
            `;


        button.addEventListener(
            "click",
            () => {

                selectWeapon(
                    weapon.id
                );

            }
        );


        weaponList.appendChild(
            button
        );

    }

}


// =========================================================
// Search
// =========================================================

searchInput.addEventListener(
    "input",
    renderWeaponList
);


// =========================================================
// Loading
// =========================================================

function renderLoading(
    name
){

    detail.innerHTML =
        `
        <div class="loading-card">

            <div
                class="loading-spinner"
            ></div>

            <h2>
                ${escapeHTML(
                    name
                )}
            </h2>

            <p>
                データを取得しています…
            </p>

        </div>
        `;

}


// =========================================================
// Error
// =========================================================

function renderError(
    weapon,
    error
){

    detail.innerHTML =
        `
        <div class="error-card">

            <h2>
                データを取得できませんでした
            </h2>

            <p>
                ${escapeHTML(
                    weapon.name
                )}
            </p>

            <small>
                ${escapeHTML(
                    error.message
                )}
            </small>

            <button
                id="retryButton"
                class="retry-button"
                type="button"
            >
                もう一度取得
            </button>

        </div>
        `;


    $("#retryButton")
        .addEventListener(
            "click",
            () => {

                selectWeapon(
                    weapon.id
                );

            }
        );

}


// =========================================================
// Weapon detail
// =========================================================

function renderWeapon(
    weapon,
    fromCache
){

    detail.innerHTML =
        `
        <div class="detail-grid">


            <section
                class="card weapon-header"
            >

                <div>

                    <div class="weapon-category">
                        ${escapeHTML(
                            weapon.category
                        )}
                    </div>

                    <h2>
                        ${escapeHTML(
                            weapon.name
                        )}
                    </h2>

                </div>


                <div class="cache-badge">

                    ${
                        fromCache
                            ? "CACHE"
                            : "NEW"
                    }

                </div>

            </section>


            <section class="card">

                <h3 class="section-title">
                    ブキ構成
                </h3>


                <div class="kit">

                    <div class="tag">

                        サブ

                        <strong>
                            ${escapeHTML(
                                weapon.sub
                            )}
                        </strong>

                    </div>


                    <div class="tag">

                        スペシャル

                        <strong>
                            ${escapeHTML(
                                weapon.special
                            )}
                        </strong>

                    </div>


                    <div class="tag">

                        必要ポイント

                        <strong>
                            ${formatNumber(
                                weapon.specialPoints
                            )}
                        </strong>

                    </div>

                </div>

            </section>


            <section class="card">

                <h3 class="section-title">
                    射程
                </h3>

                ${createRangeGraph(
                    weapon
                )}

            </section>


            <section class="card">

                <h3 class="section-title">
                    基本性能
                </h3>


                <div class="stats">

                    ${createStat(
                        "最大ダメージ",
                        formatNumber(
                            weapon.damage?.max
                        )
                    )}


                    ${createStat(
                        "最小ダメージ",
                        formatNumber(
                            weapon.damage?.min
                        )
                    )}


                    ${createStat(
                        "確定数",
                        weapon.kills || "—"
                    )}


                    ${createStat(
                        "キルタイム",
                        weapon.killTime !== null
                            ? `${weapon.killTime}秒`
                            : "—"
                    )}


                    ${createStat(
                        "連射フレーム",
                        weapon.fireFrame !== null
                            ? `${weapon.fireFrame}F`
                            : "—"
                    )}


                    ${createStat(
                        "秒間発射数",
                        formatNumber(
                            weapon.shotsPerSecond
                        )
                    )}


                    ${createStat(
                        "DPS",
                        formatNumber(
                            weapon.dps
                        )
                    )}


                    ${createStat(
                        "重量",
                        weapon.weight || "—"
                    )}

                </div>

            </section>


            <section class="card">

                <h3 class="section-title">
                    ダメージ
                </h3>

                ${createDamageGraph(
                    weapon
                )}

            </section>


            ${
                weapon.blast?.radius !== null &&
                weapon.blast?.radius !== undefined
                    ?
                    `
                    <section class="card">

                        <h3 class="section-title">
                            爆風範囲
                        </h3>

                        ${createBlastGraph(
                            weapon
                        )}

                    </section>
                    `
                    :
                    ""
            }


            <section class="card">

                <h3 class="section-title">
                    距離減衰
                </h3>

                ${createFalloffGraph(
                    weapon
                )}

            </section>


            <section class="card">

                <h3 class="section-title">
                    詳細
                </h3>


                <div class="spec-grid">

                    ${createSpec(
                        "有効射程",
                        formatNumber(
                            weapon.range?.effective
                        )
                    )}


                    ${createSpec(
                        "塗り射程",
                        formatNumber(
                            weapon.range?.paint
                        )
                    )}


                    ${createSpec(
                        "レティクル反応距離",
                        formatNumber(
                            weapon.range?.reticle
                        )
                    )}


                    ${createSpec(
                        "拡散",
                        weapon.spread !== null
                            ? `${weapon.spread}°`
                            : "—"
                    )}


                    ${createSpec(
                        "ジャンプ中拡散",
                        weapon.jumpSpread !== null
                            ? `${weapon.jumpSpread}°`
                            : "—"
                    )}

                </div>

            </section>


            <section class="card source-card">

                <div>

                    <strong>
                        データソース
                    </strong>

                    <p>
                        WikiWiki
                    </p>

                </div>


                <a
                    href="${escapeHTML(
                        weapon.source
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Wikiを開く
                </a>

            </section>


            <button
                id="clearCacheButton"
                class="clear-cache-button"
                type="button"
            >
                このブキのキャッシュを削除
            </button>


        </div>
        `;


    $("#clearCacheButton")
        .addEventListener(
            "click",
            async () => {

                await deleteCachedWeapon(
                    weapon.id
                );


                const base =
                    weapons.find(
                        item =>
                            item.id ===
                            weapon.id
                    );


                if(
                    base
                ){

                    base.cached =
                        false;

                }


                renderWeaponList();


                alert(
                    "キャッシュを削除しました"
                );

            }
        );

}


// =========================================================
// Range graph
// =========================================================

function createRangeGraph(
    weapon
){

    const effective =
        Number(
            weapon.range?.effective
        ) || 0;


    const paint =
        Number(
            weapon.range?.paint
        ) || 0;


    const blast =
        Number(
            weapon.blast?.range
        ) || 0;


    const max =
        Math.max(
            6,
            effective,
            paint,
            blast
        );


    const effectivePercent =
        effective /
        max *
        100;


    const paintPercent =
        paint /
        max *
        100;


    return `
        <div class="range-area">

            <div class="range-axis">

                <span>
                    0
                </span>

                <span>
                    ${max}
                </span>

            </div>


            <div class="range-track">

                <div
                    class="range-bar"
                    style="
                        width:${effectivePercent}%;
                    "
                ></div>


                <div
                    class="range-marker effective"
                    style="
                        left:${effectivePercent}%;
                    "
                >

                    <span>
                        有効射程
                        ${formatNumber(
                            effective
                        )}
                    </span>

                </div>


                <div
                    class="range-marker paint"
                    style="
                        left:${paintPercent}%;
                    "
                >

                    <span>
                        塗り
                        ${formatNumber(
                            paint
                        )}
                    </span>

                </div>

            </div>

        </div>
    `;

}


// =========================================================
// Damage graph
// =========================================================

function createDamageGraph(
    weapon
){

    const values = [];


    if(
        weapon.damage?.max !== null &&
        weapon.damage?.max !== undefined
    ){

        values.push({
            label:"最大",
            value:
                weapon.damage.max
        });

    }


    if(
        weapon.damage?.min !== null &&
        weapon.damage?.min !== undefined
    ){

        values.push({
            label:"最小",
            value:
                weapon.damage.min
        });

    }


    if(
        weapon.damage?.direct !== null &&
        weapon.damage?.direct !== undefined
    ){

        values.push({
            label:"直撃",
            value:
                weapon.damage.direct
        });

    }


    if(
        weapon.damage?.blast !== null &&
        weapon.damage?.blast !== undefined
    ){

        values.push({
            label:"爆風",
            value:
                weapon.damage.blast
        });

    }


    if(
        values.length === 0
    ){

        return `
            <div class="note">
                ダメージデータなし
            </div>
        `;

    }


    const max =
        Math.max(
            100,
            ...values.map(
                item =>
                    item.value
            )
        );


    return `
        <div class="damage-list">

            ${
                values.map(
                    item => {

                        const width =
                            item.value /
                            max *
                            100;


                        return `
                            <div class="damage-row">

                                <div class="damage-label">
                                    ${escapeHTML(
                                        item.label
                                    )}
                                </div>


                                <div class="damage-track">

                                    <div
                                        class="damage-fill"
                                        style="
                                            width:${width}%;
                                        "
                                    ></div>

                                </div>


                                <div class="damage-value">
                                    ${formatNumber(
                                        item.value
                                    )}
                                </div>

                            </div>
                        `;

                    }
                ).join("")
            }

        </div>
    `;

}


// =========================================================
// Blast graph
// =========================================================

function createBlastGraph(
    weapon
){

    const radius =
        Number(
            weapon.blast?.radius
        ) || 0;


    if(
        radius <= 0
    ){

        return `
            <div class="note">
                爆風データなし
            </div>
        `;

    }


    const size =
        Math.max(
            100,
            Math.min(
                220,
                radius * 180
            )
        );


    return `
        <div class="blast-area">

            <div
                class="blast-circle"
                style="
                    width:${size}px;
                    height:${size}px;
                "
            >

                <span>
                    ${formatNumber(
                        radius
                    )}
                </span>

            </div>


            <div class="blast-caption">

                爆風半径
                ${formatNumber(
                    radius
                )}

            </div>

        </div>
    `;

}


// =========================================================
// Falloff graph
// =========================================================

function createFalloffGraph(
    weapon
){

    const maxDamage =
        Number(
            weapon.damage?.max
        );


    const minDamage =
        Number(
            weapon.damage?.min
        );


    const range =
        Number(
            weapon.range?.effective
        );


    if(
        !Number.isFinite(
            maxDamage
        ) ||
        !Number.isFinite(
            minDamage
        ) ||
        !Number.isFinite(
            range
        ) ||
        range <= 0
    ){

        return `
            <div class="note">
                距離減衰データなし
            </div>
        `;

    }


    const width = 360;

    const height = 180;

    const left = 35;

    const right = 15;

    const top = 15;

    const bottom = 30;


    const graphWidth =
        width -
        left -
        right;


    const graphHeight =
        height -
        top -
        bottom;


    const yMax =
        Math.max(
            100,
            maxDamage
        );


    const points = [];


    for(
        let i = 0;
        i <= 20;
        i++
    ){

        const x =
            i / 20;


        const damage =
            maxDamage +
            (
                minDamage -
                maxDamage
            ) *
            x;


        const px =
            left +
            graphWidth *
            x;


        const py =
            top +
            graphHeight *
            (
                1 -
                damage /
                yMax
            );


        points.push(
            `${px},${py}`
        );

    }


    return `
        <div class="chart">

            <svg
                viewBox="
                    0 0
                    ${width}
                    ${height}
                "
                preserveAspectRatio="none"
            >

                <line
                    x1="${left}"
                    y1="${top}"
                    x2="${left}"
                    y2="${height - bottom}"
                    class="chart-axis"
                />


                <line
                    x1="${left}"
                    y1="${height - bottom}"
                    x2="${width - right}"
                    y2="${height - bottom}"
                    class="chart-axis"
                />


                <polyline
                    points="${points.join(" ")}"
                    class="chart-line"
                />

            </svg>


            <div class="chart-label top">
                ${formatNumber(
                    maxDamage
                )}
            </div>


            <div class="chart-label bottom">
                ${formatNumber(
                    minDamage
                )}
            </div>


            <div class="chart-label right">
                ${formatNumber(
                    range
                )} 射程
            </div>

        </div>
    `;

}


// =========================================================
// UI helpers
// =========================================================

function createStat(
    label,
    value
){

    return `
        <div class="stat">

            <span class="stat-label">
                ${escapeHTML(
                    label
                )}
            </span>


            <strong class="stat-value">
                ${escapeHTML(
                    String(value)
                )}
            </strong>

        </div>
    `;

}


function createSpec(
    label,
    value
){

    return `
        <div class="spec">

            <span>
                ${escapeHTML(
                    label
                )}
            </span>


            <strong>
                ${escapeHTML(
                    String(value)
                )}
            </strong>

        </div>
    `;

}


// =========================================================
// Start
// =========================================================

async function startApp(){

    try{

        dataStatus.textContent =
            "初期化中…";


        await openDatabase();


        await loadCategories();


    }catch(error){

        console.error(
            error
        );


        dataStatus.textContent =
            "読み込みエラー";


        detail.innerHTML =
            `
            <div class="error-card">

                <h2>
                    初期化に失敗しました
                </h2>

                <p>
                    ${escapeHTML(
                        error.message
                    )}
                </p>

            </div>
            `;

    }

}


startApp();
