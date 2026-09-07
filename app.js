/* =========================================================
   Splatoon 3 Weapon Analyzer
   WikiWiki lazy loading + IndexedDB cache
========================================================= */

const READER_API = "https://r.jina.ai/";
const WIKI_BASE = "https://wikiwiki.jp/splatoon3mix/";

const DB_NAME = "splatoon3_weapon_analyzer";
const DB_VERSION = 1;
const STORE_NAME = "weapons";

let categories = [];
let weapons = [];
let currentCategory = "all";
let currentWeapon = null;

/* =========================================================
   DOM
========================================================= */

const categoryList = document.getElementById("categoryList");
const weaponList = document.getElementById("weaponList");
const searchInput = document.getElementById("searchInput");
const statusText = document.getElementById("statusText");
const detail = document.getElementById("weaponDetail");

/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await openDB();
        await loadCategories();
        setupEvents();

        setStatus("カテゴリを選択してください");
    } catch (error) {
        console.error(error);
        setStatus("初期化に失敗しました");
    }
});

/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            renderWeaponList();
        });
    }
}

/* =========================================================
   STATUS
========================================================= */

function setStatus(text) {
    if (statusText) {
        statusText.textContent = text;
    }
}

/* =========================================================
   CATEGORIES
========================================================= */

async function loadCategories() {

    const response = await fetch("./data/categories.json", {
        cache: "no-cache"
    });

    if (!response.ok) {
        throw new Error("categories.json を読み込めません");
    }

    categories = await response.json();

    renderCategories();
}

/* =========================================================
   CATEGORY UI
========================================================= */

function renderCategories() {

    if (!categoryList) return;

    categoryList.innerHTML = "";

    const allButton = document.createElement("button");

    allButton.className =
        currentCategory === "all"
            ? "category-button active"
            : "category-button";

    allButton.textContent = "すべて";

    allButton.addEventListener("click", async () => {
        currentCategory = "all";

        updateCategoryButtons();

        await loadAllCategories();
    });

    categoryList.appendChild(allButton);

    categories.forEach((category, index) => {

        const button = document.createElement("button");

        button.className =
            currentCategory === index
                ? "category-button active"
                : "category-button";

        button.textContent = category.name;

        button.addEventListener("click", async () => {

            currentCategory = index;

            updateCategoryButtons();

            await loadCategory(category);
        });

        categoryList.appendChild(button);
    });
}

function updateCategoryButtons() {

    const buttons =
        categoryList.querySelectorAll(".category-button");

    buttons.forEach((button, index) => {

        const active =
            currentCategory === "all"
                ? index === 0
                : index === currentCategory + 1;

        button.classList.toggle("active", active);
    });
}

/* =========================================================
   LOAD ALL
========================================================= */

async function loadAllCategories() {

    weapons = [];

    weaponList.innerHTML = "";

    setStatus("武器一覧を取得中...");

    for (const category of categories) {

        try {

            const list =
                await getCategoryWeapons(category);

            weapons.push(...list);

        } catch (error) {

            console.error(
                "カテゴリ取得失敗:",
                category.name,
                error
            );
        }
    }

    weapons = uniqueWeapons(weapons);

    renderWeaponList();

    setStatus(`${weapons.length}種類の武器`);
}

/* =========================================================
   LOAD CATEGORY
========================================================= */

async function loadCategory(category) {

    weapons = [];

    weaponList.innerHTML = "";

    setStatus(
        `${category.name}の武器一覧を取得中...`
    );

    try {

        weapons =
            await getCategoryWeapons(category);

        weapons =
            uniqueWeapons(weapons);

        renderWeaponList();

        setStatus(
            `${category.name}：${weapons.length}種類`
        );

    } catch (error) {

        console.error(error);

        setStatus(
            "武器一覧の取得に失敗しました"
        );

        weaponList.innerHTML = `
            <div class="error-box">
                武器一覧を取得できませんでした。<br>
                もう一度カテゴリを選択してください。
            </div>
        `;
    }
}

/* =========================================================
   CATEGORY PAGE
========================================================= */

async function getCategoryWeapons(category) {

    const text =
        await fetchWikiPage(category.url);

    return parseCategoryPage(text);
}

/* =========================================================
   WIKIWIKI FETCH
========================================================= */

async function fetchWikiPage(url) {

    const readerURL =
        READER_API + url;

    const response =
        await fetch(readerURL, {
            method: "GET",
            cache: "no-cache"
        });

    if (!response.ok) {

        throw new Error(
            `Reader HTTP ${response.status}`
        );
    }

    return await response.text();
}

/* =========================================================
   CATEGORY PARSER
========================================================= */

function parseCategoryPage(text) {

    const result = [];

    /*
       WikiWikiはPukiWiki形式。

       例：

       |&attachref(icon/スプラシューター.png,...);
       スプラシューター|2.6|36.0...

       または

       |&attachref(...);
       [[ヒーローシューター
       レプリカ>ブキ/ヒーローシューター レプリカ]]|...
    */

    const lines =
        text.split(/\r?\n/);

    for (let line of lines) {

        if (!line.includes("attachref")) {
            continue;
        }

        if (!line.includes("icon/")) {
            continue;
        }

        let name = null;
        let pagePath = null;

        /* ---------------------------------------------
           [[表示名>ブキ/ページ名]]
        --------------------------------------------- */

        const linked =
            line.match(
                /\[\[([\s\S]*?)>(ブキ\/[^|\]]+)\]\]/
            );

        if (linked) {

            name =
                cleanWeaponName(linked[1]);

            pagePath =
                linked[2];

        } else {

            /* -----------------------------------------
               attachref(...);武器名
            ----------------------------------------- */

            const attach =
                line.match(
                    /attachref\([^)]*\);([^|]+)/i
                );

            if (!attach) {
                continue;
            }

            name =
                cleanWeaponName(
                    attach[1]
                );

            if (!name) {
                continue;
            }

            pagePath =
                "ブキ/" + name;
        }

        /* ---------------------------------------------
           除外
        --------------------------------------------- */

        if (!name) {
            continue;
        }

        if (
            name === "メインウェポン" ||
            name === "サブウェポン" ||
            name === "スペシャルウェポン"
        ) {
            continue;
        }

        if (
            name.includes("種について") ||
            name.includes("属について")
        ) {
            continue;
        }

        /* ---------------------------------------------
           URL
        --------------------------------------------- */

        const url =
            WIKI_BASE +
            pagePath
                .split("/")
                .map(part => encodeURIComponent(part))
                .join("/");

        result.push({
            name,
            url
        });
    }

    /*
       PukiWikiの表では一部武器が
       attachref + 通常テキストなので、
       念のため直接のブキ/リンクも探す。
    */

    const directLinks =
        text.matchAll(
            /\[\[([^\]]+?)>(ブキ\/[^|\]]+)\]\]/g
        );

    for (const match of directLinks) {

        let name =
            cleanWeaponName(match[1]);

        const pagePath =
            match[2];

        if (!name) continue;

        if (
            name.includes("ブラスター") === false &&
            name.includes("シューター") === false &&
            name.includes("ローラー") === false &&
            name.includes("チャージャー") === false &&
            name.includes("スロッシャー") === false &&
            name.includes("スピナー") === false &&
            name.includes("マニューバー") === false &&
            name.includes("シェルター") === false &&
            name.includes("ストリンガー") === false &&
            name.includes("ワイパー") === false &&
            name.includes("フデ") === false
        ) {
            /*
               名前だけで判定できない武器もあるため、
               URLが「ブキ/」なら追加候補にする。
            */
        }

        const url =
            WIKI_BASE +
            pagePath
                .split("/")
                .map(part => encodeURIComponent(part))
                .join("/");

        result.push({
            name,
            url
        });
    }

    return uniqueWeapons(result);
}

/* =========================================================
   CLEAN NAME
========================================================= */

function cleanWeaponName(name) {

    return name
        .replace(/&br;/g, "")
        .replace(/<br\s*\/?>/gi, "")
        .replace(/&color\([^)]*\)\{/g, "")
        .replace(/\}/g, "")
        .replace(/&size\([^)]*\)\{/g, "")
        .replace(/&ref\([^)]*\);/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/* =========================================================
   UNIQUE
========================================================= */

function uniqueWeapons(list) {

    const map =
        new Map();

    for (const weapon of list) {

        if (!weapon.name) {
            continue;
        }

        if (!weapon.url) {
            continue;
        }

        const key =
            weapon.url;

        if (!map.has(key)) {
            map.set(key, weapon);
        }
    }

    return Array.from(map.values());
}

/* =========================================================
   WEAPON LIST
========================================================= */

function renderWeaponList() {

    if (!weaponList) return;

    weaponList.innerHTML = "";

    const keyword =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";

    const filtered =
        weapons.filter(weapon => {

            if (!keyword) {
                return true;
            }

            return weapon.name
                .toLowerCase()
                .includes(keyword);
        });

    if (filtered.length === 0) {

        weaponList.innerHTML = `
            <div class="empty-box">
                武器が見つかりません
            </div>
        `;

        return;
    }

    filtered.forEach(weapon => {

        const button =
            document.createElement("button");

        button.className =
            "weapon-item";

        button.innerHTML = `
            <div class="weapon-item-name">
                ${escapeHTML(weapon.name)}
            </div>
            <div class="weapon-item-arrow">
                ›
            </div>
        `;

        button.addEventListener(
            "click",
            () => {
                selectWeapon(weapon);
            }
        );

        weaponList.appendChild(button);
    });
}

/* =========================================================
   SELECT WEAPON
========================================================= */

async function selectWeapon(weapon) {

    currentWeapon = weapon;

    detail.innerHTML = `
        <div class="loading-box">
            <div class="loading-title">
                ${escapeHTML(weapon.name)}
            </div>
            <div>
                データを取得しています...
            </div>
        </div>
    `;

    setStatus(
        `${weapon.name}を読み込み中...`
    );

    /* ---------------------------------------------
       CACHE
    --------------------------------------------- */

    const cached =
        await getCachedWeapon(
            weapon.url
        );

    if (cached) {

        console.log(
            "IndexedDB cache:",
            weapon.name
        );

        renderWeaponDetail(cached);

        setStatus(
            `${weapon.name}：キャッシュから表示`
        );

        return;
    }

    /* ---------------------------------------------
       WIKI
    --------------------------------------------- */

    try {

        const text =
            await fetchWikiPage(
                weapon.url
            );

        const data =
            parseWeaponPage(
                text,
                weapon
            );

        await saveCachedWeapon(data);

        renderWeaponDetail(data);

        setStatus(
            `${weapon.name}：WikiWikiから取得`
        );

    } catch (error) {

        console.error(error);

        detail.innerHTML = `
            <div class="error-box">
                <h3>データ取得失敗</h3>
                <p>
                    ${escapeHTML(weapon.name)}
                </p>

                <button
                    class="retry-button"
                    id="retryWeapon"
                >
                    再取得
                </button>
            </div>
        `;

        document
            .getElementById("retryWeapon")
            ?.addEventListener(
                "click",
                () => selectWeapon(weapon)
            );
    }
}

/* =========================================================
   WEAPON PAGE PARSER
========================================================= */

function parseWeaponPage(text, weapon) {

    const data = {

        name: weapon.name,

        url: weapon.url,

        sub: findValue(
            text,
            [
                "サブウェポン",
                "サブ"
            ]
        ),

        special: findValue(
            text,
            [
                "スペシャルウェポン",
                "スペシャル"
            ]
        ),

        points: findNumber(
            text,
            [
                "必要ポイント",
                "必要P"
            ]
        ),

        range: findNumber(
            text,
            [
                "有効射程"
            ]
        ),

        paintRange: findNumber(
            text,
            [
                "塗り射程"
            ]
        ),

        damage: findDamage(
            text
        ),

        kills: findValue(
            text,
            [
                "確定数"
            ]
        ),

        fireFrames: findNumber(
            text,
            [
                "連射フレーム"
            ]
        ),

        shotsPerSecond: findNumber(
            text,
            [
                "秒間発射数"
            ]
        ),

        killTime: findNumber(
            text,
            [
                "キルタイム"
            ]
        ),

        dps: findNumber(
            text,
            [
                "DPS"
            ]
        ),

        spread: findNumber(
            text,
            [
                "拡散"
            ]
        ),

        jumpSpread: findNumber(
            text,
            [
                "ジャンプ中拡散"
            ]
        ),

        reticleRange: findNumber(
            text,
            [
                "レティクル反応距離"
            ]
        ),

        blastRadius: findNumber(
            text,
            [
                "爆風半径",
                "爆風範囲"
            ]
        ),

        directDamage: findNumber(
            text,
            [
                "直撃ダメージ"
            ]
        ),

        blastDamage: findNumber(
            text,
            [
                "爆風ダメージ"
            ]
        ),

        damageRange: findNumber(
            text,
            [
                "ダメージ射程"
            ]
        ),

        weight: findValue(
            text,
            [
                "ブキ重量"
            ]
        ),

        fetchedAt:
            Date.now()
    };

    return data;
}

/* =========================================================
   TEXT FIND
========================================================= */

function normalizeText(text) {

    return text
        .replace(/\r/g, "")
        .replace(/&br;/g, " ")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/\{\{/g, "")
        .replace(/\}\}/g, "")
        .replace(/\s+/g, " ");
}

function findValue(text, labels) {

    const normalized =
        normalizeText(text);

    for (const label of labels) {

        const regex =
            new RegExp(
                escapeRegExp(label) +
                "[^\\n|]{0,100}",
                "i"
            );

        const match =
            normalized.match(regex);

        if (!match) continue;

        let value =
            match[0]
                .replace(
                    new RegExp(
                        "^.*?" +
                        escapeRegExp(label),
                        "i"
                    ),
                    ""
                )
                .replace(/[|:：]/g, "")
                .trim();

        if (value) {
            return value;
        }
    }

    return "—";
}

/* =========================================================
   NUMBER
========================================================= */

function findNumber(text, labels) {

    const value =
        findValue(text, labels);

    const match =
        value.match(
            /-?\d+(?:\.\d+)?
            /x
        );

    if (!match) {
        return null;
    }

    return Number(match[0]);
}

/* =========================================================
   DAMAGE
========================================================= */

function findDamage(text) {

    const value =
        findValue(
            text,
            [
                "ダメージ"
            ]
        );

    const numbers =
        value.match(
            /\d+(?:\.\d+)?/g
        );

    if (!numbers || numbers.length === 0) {
        return {
            max: null,
            min: null,
            raw: "—"
        };
    }

    const nums =
        numbers.map(Number);

    return {
        max: Math.max(...nums),
        min: Math.min(...nums),
        raw: value
    };
}

/* =========================================================
   DETAIL
========================================================= */

function renderWeaponDetail(data) {

    const maxDamage =
        data.damage?.max ?? null;

    const minDamage =
        data.damage?.min ?? null;

    detail.innerHTML = `

        <div class="weapon-header">

            <div>
                <div class="detail-label">
                    WEAPON
                </div>

                <h2>
                    ${escapeHTML(data.name)}
                </h2>
            </div>

            <button
                class="cache-delete"
                id="deleteCache"
            >
                キャッシュ削除
            </button>

        </div>

        <section class="detail-card">

            <h3>基本情報</h3>

            <div class="stat-grid">

                ${stat(
                    "サブ",
                    data.sub
                )}

                ${stat(
                    "スペシャル",
                    data.special
                )}

                ${stat(
                    "必要ポイント",
                    formatNumber(data.points, "p")
                )}

                ${stat(
                    "ブキ重量",
                    data.weight
                )}

            </div>

        </section>

        <section class="detail-card">

            <h3>射程</h3>

            <div class="range-number">

                ${
                    data.range !== null
                        ? data.range.toFixed(1)
                        : "—"
                }

                <span>
                    射程
                </span>

            </div>

            ${createRangeGraph(data)}

        </section>

        <section class="detail-card">

            <h3>ダメージ</h3>

            <div class="damage-values">

                <div>
                    <strong>
                        ${
                            maxDamage !== null
                                ? maxDamage
                                : "—"
                        }
                    </strong>

                    <span>
                        最大
                    </span>
                </div>

                <div>
                    <strong>
                        ${
                            minDamage !== null
                                ? minDamage
                                : "—"
                        }
                    </strong>

                    <span>
                        最小
                    </span>
                </div>

            </div>

            ${createDamageGraph(data)}

        </section>

        <section class="detail-card">

            <h3>距離減衰</h3>

            ${createFalloffGraph(data)}

        </section>

        ${
            hasBlast(data)
                ? `
                    <section class="detail-card">

                        <h3>爆風範囲</h3>

                        ${createBlastGraph(data)}

                    </section>
                  `
                : ""
        }

        <section class="detail-card">

            <h3>性能</h3>

            <div class="stat-grid">

                ${stat(
                    "確定数",
                    data.kills
                )}

                ${stat(
                    "キルタイム",
                    data.killTime !== null
                        ? data.killTime + "秒"
                        : "—"
                )}

                ${stat(
                    "連射フレーム",
                    formatNumber(
                        data.fireFrames,
                        "F"
                    )
                )}

                ${stat(
                    "秒間発射数",
                    formatNumber(
                        data.shotsPerSecond,
                        "発"
                    )
                )}

                ${stat(
                    "DPS",
                    data.dps
                )}

                ${stat(
                    "拡散",
                    data.spread !== null
                        ? data.spread + "°"
                        : "—"
                )}

                ${stat(
                    "ジャンプ中拡散",
                    data.jumpSpread !== null
                        ? data.jumpSpread + "°"
                        : "—"
                )}

            </div>

        </section>

        <section class="source-card">

            データ：
            WikiWiki.jp / splatoon3mix

            <a
                href="${escapeAttribute(data.url)}"
                target="_blank"
                rel="noopener"
            >
                WikiWikiで詳細を見る
            </a>

        </section>
    `;

    document
        .getElementById("deleteCache")
        ?.addEventListener(
            "click",
            async () => {

                await deleteCachedWeapon(
                    data.url
                );

                setStatus(
                    `${data.name}のキャッシュを削除しました`
                );
            }
        );
}

/* =========================================================
   STAT
========================================================= */

function stat(label, value) {

    return `
        <div class="stat">

            <span>
                ${escapeHTML(label)}
            </span>

            <strong>
                ${escapeHTML(
                    value === null ||
                    value === undefined
                        ? "—"
                        : String(value)
                )}
            </strong>

        </div>
    `;
}

/* =========================================================
   RANGE GRAPH
========================================================= */

function createRangeGraph(data) {

    const range =
        data.range ?? 0;

    const paint =
        data.paintRange ?? 0;

    const max =
        Math.max(
            6,
            range,
            paint
        );

    const rangeWidth =
        Math.min(
            100,
            range / max * 100
        );

    const paintWidth =
        Math.min(
            100,
            paint / max * 100
        );

    const blast =
        data.blastRadius ?? 0;

    return `

        <div class="range-graph">

            <div class="range-track">

                <div
                    class="range-paint"
                    style="width:${paintWidth}%"
                ></div>

                <div
                    class="range-main"
                    style="width:${rangeWidth}%"
                ></div>

                ${
                    blast > 0
                        ? `
                            <div
                                class="blast-endpoint"
                                style="left:${rangeWidth}%"
                            >
                                <div
                                    class="blast-endpoint-circle"
                                    style="
                                        width:${Math.max(
                                            22,
                                            blast * 40
                                        )}px;
                                        height:${Math.max(
                                            22,
                                            blast * 40
                                        )}px;
                                    "
                                ></div>
                            </div>
                          `
                        : ""
                }

            </div>

            <div class="range-scale">

                <span>0</span>

                <span>
                    ${max.toFixed(1)}
                </span>

            </div>

            <div class="range-legend">

                <span>
                    <i class="legend-main"></i>
                    有効射程
                </span>

                <span>
                    <i class="legend-paint"></i>
                    塗り射程
                </span>

            </div>

        </div>
    `;
}

/* =========================================================
   DAMAGE GRAPH
========================================================= */

function createDamageGraph(data) {

    const max =
        data.damage?.max;

    const min =
        data.damage?.min;

    if (
        max === null ||
        max === undefined
    ) {
        return `
            <div class="empty-box">
                ダメージデータなし
            </div>
        `;
    }

    const minimum =
        min ?? max;

    const maxWidth = 100;

    const minWidth =
        Math.max(
            0,
            minimum / max * 100
        );

    return `

        <div class="damage-graph">

            <div class="damage-row">

                <span>
                    最大
                </span>

                <div class="damage-track">

                    <div
                        class="damage-fill"
                        style="width:${maxWidth}%"
                    ></div>

                </div>

                <strong>
                    ${max}
                </strong>

            </div>

            <div class="damage-row">

                <span>
                    最小
                </span>

                <div class="damage-track">

                    <div
                        class="damage-fill min"
                        style="width:${minWidth}%"
                    ></div>

                </div>

                <strong>
                    ${minimum}
                </strong>

            </div>

        </div>
    `;
}

/* =========================================================
   FALLOFF
========================================================= */

function createFalloffGraph(data) {

    const max =
        data.damage?.max;

    const min =
        data.damage?.min;

    const range =
        data.range;

    if (
        max === null ||
        max === undefined ||
        range === null ||
        range === undefined
    ) {
        return `
            <div class="empty-box">
                距離減衰データなし
            </div>
        `;
    }

    const low =
        min ?? max;

    const points = [];

    for (let i = 0; i <= 10; i++) {

        const x =
            20 + i * 32;

        const ratio =
            i / 10;

        const y =
            25 +
            ratio * 90;

        points.push(
            `${x},${y}`
        );
    }

    return `

        <div class="falloff-chart">

            <svg
                viewBox="0 0 340 140"
                preserveAspectRatio="none"
            >

                <polyline
                    points="${points.join(" ")}"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="4"
                />

            </svg>

            <div class="falloff-label max">
                ${max}
            </div>

            <div class="falloff-label min">
                ${low}
            </div>

        </div>

        <div class="falloff-axis">

            <span>近距離</span>

            <span>
                ${range.toFixed(1)}
            </span>

            <span>遠距離</span>

        </div>
    `;
}

/* =========================================================
   BLAST
========================================================= */

function hasBlast(data) {

    return (
        data.blastRadius !== null &&
        data.blastRadius > 0
    );
}

function createBlastGraph(data) {

    const radius =
        data.blastRadius;

    return `

        <div class="blast-graph">

            <div
                class="blast-circle"
                style="
                    width:${Math.max(
                        80,
                        radius * 160
                    )}px;

                    height:${Math.max(
                        80,
                        radius * 160
                    )}px;
                "
            ></div>

            <div class="blast-info">

                <strong>
                    ${radius} m
                </strong>

                <span>
                    爆風半径
                </span>

                ${
                    data.blastDamage !== null
                        ? `
                            <span>
                                爆風ダメージ：
                                ${data.blastDamage}
                            </span>
                          `
                        : ""
                }

            </div>

        </div>
    `;
}

/* =========================================================
   INDEXED DB
========================================================= */

function openDB() {

    return new Promise(
        (resolve, reject) => {

            const request =
                indexedDB.open(
                    DB_NAME,
                    DB_VERSION
                );

            request.onupgradeneeded =
                event => {

                    const db =
                        event.target.result;

                    if (
                        !db.objectStoreNames
                            .contains(STORE_NAME)
                    ) {

                        db.createObjectStore(
                            STORE_NAME,
                            {
                                keyPath: "url"
                            }
                        );
                    }
                };

            request.onsuccess =
                event => {

                    resolve(
                        event.target.result
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

/* =========================================================
   CACHE GET
========================================================= */

async function getCachedWeapon(url) {

    const db =
        await openDB();

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readonly"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.get(url);

            request.onsuccess =
                () => {

                    resolve(
                        request.result || null
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

/* =========================================================
   CACHE SAVE
========================================================= */

async function saveCachedWeapon(data) {

    const db =
        await openDB();

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.put(data);

            request.onsuccess =
                () => resolve();

            request.onerror =
                () => reject(
                    request.error
                );
        }
    );
}

/* =========================================================
   CACHE DELETE
========================================================= */

async function deleteCachedWeapon(url) {

    const db =
        await openDB();

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.delete(url);

            request.onsuccess =
                () => resolve();

            request.onerror =
                () => reject(
                    request.error
                );
        }
    );
}

/* =========================================================
   FORMAT
========================================================= */

function formatNumber(value, suffix = "") {

    if (
        value === null ||
        value === undefined ||
        Number.isNaN(value)
    ) {
        return "—";
    }

    return `${value}${suffix}`;
}

/* =========================================================
   ESCAPE
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {

    return escapeHTML(value);
}

function escapeRegExp(value) {

    return String(value)
        .replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
}
