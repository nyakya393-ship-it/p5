/* =========================================================
   SPLATOON 3 WEAPON ANALYZER
   ---------------------------------------------------------
   GitHub Pages
   WikiWiki.jp
   Jina Reader
   IndexedDB cache
========================================================= */


/* =========================================================
   SETTINGS
========================================================= */

const READER_API =
    "https://r.jina.ai/";

const WIKI_BASE =
    "https://wikiwiki.jp/splatoon3mix/";

const DB_NAME =
    "splatoon3_weapon_analyzer";

const DB_VERSION =
    1;

const STORE_NAME =
    "weapons";


/* =========================================================
   CATEGORY DATA
   categories.json は使用しない
========================================================= */

const CATEGORIES = [

    {
        id: "all",
        name: "すべて",
        url: null
    },

    {
        id: "shooter",
        name: "シューター",
        url:
            WIKI_BASE +
            "ブキ/シューター属"
    },

    {
        id: "blaster",
        name: "ブラスター",
        url:
            WIKI_BASE +
            "ブキ/ブラスター属"
    },

    {
        id: "roller",
        name: "ローラー",
        url:
            WIKI_BASE +
            "ブキ/ローラー属"
    },

    {
        id: "brush",
        name: "フデ",
        url:
            WIKI_BASE +
            "ブキ/フデ属"
    },

    {
        id: "charger",
        name: "チャージャー",
        url:
            WIKI_BASE +
            "ブキ/チャージャー属"
    },

    {
        id: "slosher",
        name: "スロッシャー",
        url:
            WIKI_BASE +
            "ブキ/スロッシャー属"
    },

    {
        id: "splatling",
        name: "スピナー",
        url:
            WIKI_BASE +
            "ブキ/スピナー属"
    },

    {
        id: "dualies",
        name: "マニューバー",
        url:
            WIKI_BASE +
            "ブキ/マニューバー属"
    },

    {
        id: "shelter",
        name: "シェルター",
        url:
            WIKI_BASE +
            "ブキ/シェルター属"
    },

    {
        id: "stringer",
        name: "ストリンガー",
        url:
            WIKI_BASE +
            "ブキ/ストリンガー属"
    },

    {
        id: "wiper",
        name: "ワイパー",
        url:
            WIKI_BASE +
            "ブキ/ワイパー属"
    }

];


/* =========================================================
   STATE
========================================================= */

let weapons = [];

let currentCategory =
    "all";

let currentWeapon =
    null;

let dbPromise =
    null;


/* =========================================================
   DOM
========================================================= */

const categoryList =
    document.getElementById(
        "categoryList"
    );

const weaponList =
    document.getElementById(
        "weaponList"
    );

const weaponDetail =
    document.getElementById(
        "weaponDetail"
    );

const searchInput =
    document.getElementById(
        "searchInput"
    );

const statusText =
    document.getElementById(
        "statusText"
    );

const categoryCount =
    document.getElementById(
        "categoryCount"
    );

const weaponCount =
    document.getElementById(
        "weaponCount"
    );


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    init
);


async function init() {

    renderCategories();

    updateCategoryCount();

    setupSearch();

    try {

        await openDatabase();

        setStatus(
            "カテゴリを選択"
        );

    } catch (error) {

        console.error(
            "IndexedDB error:",
            error
        );

        setStatus(
            "準備完了"
        );
    }
}


/* =========================================================
   STATUS
========================================================= */

function setStatus(text) {

    if (!statusText) {
        return;
    }

    statusText.textContent =
        text;
}


/* =========================================================
   CATEGORY UI
========================================================= */

function renderCategories() {

    categoryList.innerHTML = "";

    CATEGORIES.forEach(
        category => {

            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.className =
                "category-button";

            if (
                category.id ===
                currentCategory
            ) {

                button.classList.add(
                    "active"
                );
            }

            button.textContent =
                category.name;

            button.addEventListener(
                "click",
                () => {

                    selectCategory(
                        category
                    );
                }
            );

            categoryList.appendChild(
                button
            );
        }
    );
}


/* =========================================================
   CATEGORY COUNT
========================================================= */

function updateCategoryCount() {

    if (!categoryCount) {
        return;
    }

    categoryCount.textContent =
        CATEGORIES.length - 1;
}


/* =========================================================
   CATEGORY SELECT
========================================================= */

async function selectCategory(
    category
) {

    currentCategory =
        category.id;

    updateCategoryButtons();

    searchInput.value = "";

    weapons = [];

    renderWeaponList();

    if (category.id === "all") {

        await loadAllCategories();

        return;
    }

    await loadCategory(
        category
    );
}


/* =========================================================
   ACTIVE BUTTON
========================================================= */

function updateCategoryButtons() {

    const buttons =
        categoryList.querySelectorAll(
            ".category-button"
        );

    buttons.forEach(
        (button, index) => {

            const category =
                CATEGORIES[index];

            button.classList.toggle(
                "active",
                category.id ===
                currentCategory
            );
        }
    );
}


/* =========================================================
   LOAD ONE CATEGORY
========================================================= */

async function loadCategory(
    category
) {

    setStatus(
        `${category.name}を取得中…`
    );

    weaponList.innerHTML = `
        <div class="empty-list">
            <div class="empty-icon">
                …
            </div>

            <strong>
                ${escapeHTML(category.name)}
                を読み込んでいます
            </strong>

            <span>
                WikiWikiから武器一覧を取得中…
            </span>
        </div>
    `;

    try {

        const text =
            await fetchWiki(
                category.url
            );

        const parsed =
            parseCategory(
                text
            );

        weapons =
            uniqueWeapons(
                parsed
            );

        renderWeaponList();

        setStatus(
            `${category.name}：${weapons.length}種類`
        );

    } catch (error) {

        console.error(error);

        weapons = [];

        weaponList.innerHTML = `
            <div class="error-box">

                <strong>
                    武器一覧を取得できませんでした
                </strong>

                <span>
                    ${escapeHTML(
                        error.message
                    )}
                </span>

                <button
                    type="button"
                    class="category-button"
                    style="margin-top:18px;"
                    id="retryCategory"
                >
                    再取得
                </button>

            </div>
        `;

        document
            .getElementById(
                "retryCategory"
            )
            ?.addEventListener(
                "click",
                () => {
                    loadCategory(
                        category
                    );
                }
            );

        setStatus(
            "取得失敗"
        );
    }
}


/* =========================================================
   LOAD ALL
========================================================= */

async function loadAllCategories() {

    weapons = [];

    renderWeaponList();

    let failed =
        0;

    for (
        let i = 1;
        i < CATEGORIES.length;
        i++
    ) {

        const category =
            CATEGORIES[i];

        setStatus(
            `${category.name}を取得中…`
        );

        try {

            const text =
                await fetchWiki(
                    category.url
                );

            const parsed =
                parseCategory(
                    text
                );

            weapons.push(
                ...parsed
            );

            weapons =
                uniqueWeapons(
                    weapons
                );

            renderWeaponList();

        } catch (error) {

            console.error(
                category.name,
                error
            );

            failed++;
        }
    }

    weapons =
        uniqueWeapons(
            weapons
        );

    renderWeaponList();

    if (failed > 0) {

        setStatus(
            `${weapons.length}種類 / ${failed}カテゴリ取得失敗`
        );

    } else {

        setStatus(
            `${weapons.length}種類`
        );
    }
}


/* =========================================================
   FETCH WIKI THROUGH JINA
========================================================= */

async function fetchWiki(url) {

    if (!url) {

        throw new Error(
            "URLがありません"
        );
    }

    const readerURL =
        READER_API +
        url;

    const response =
        await fetch(
            readerURL,
            {
                method: "GET",
                cache: "no-store",
                headers: {
                    "Accept":
                        "text/plain"
                }
            }
        );

    if (!response.ok) {

        throw new Error(
            `取得エラー HTTP ${response.status}`
        );
    }

    const text =
        await response.text();

    if (
        !text ||
        text.trim().length < 20
    ) {

        throw new Error(
            "取得したページが空です"
        );
    }

    return text;
}


/* =========================================================
   PARSE CATEGORY
========================================================= */

function parseCategory(text) {

    const result = [];

    /*
       -----------------------------------------------------
       パターン1
       PukiWiki

       [[スプラシューター>ブキ/スプラシューター]]
       -----------------------------------------------------
    */

    const pukiRegex =
        /\[\[([^\]]+?)>(ブキ\/[^|\]\n]+)\]\]/g;

    let match;

    while (
        (match =
            pukiRegex.exec(text)) !== null
    ) {

        const name =
            cleanWeaponName(
                match[1]
            );

        const path =
            cleanPagePath(
                match[2]
            );

        if (
            isValidWeapon(
                name,
                path
            )
        ) {

            result.push(
                createWeapon(
                    name,
                    path
                )
            );
        }
    }


    /*
       -----------------------------------------------------
       パターン2
       Markdown化されたリンク

       [スプラシューター](https://wikiwiki.jp/...)
       -----------------------------------------------------
    */

    const markdownRegex =
        /\[([^\]]+)\]\((https:\/\/wikiwiki\.jp\/splatoon3mix\/[^)\s]+)\)/g;

    while (
        (match =
            markdownRegex.exec(text)) !== null
    ) {

        const name =
            cleanWeaponName(
                match[1]
            );

        const url =
            decodeURL(
                match[2]
            );

        const path =
            extractWikiPath(
                url
            );

        if (
            isValidWeapon(
                name,
                path
            )
        ) {

            result.push({
                name,
                url
            });
        }
    }


    /*
       -----------------------------------------------------
       パターン3
       ページURLそのもの
       -----------------------------------------------------
    */

    const urlRegex =
        /https:\/\/wikiwiki\.jp\/splatoon3mix\/ブキ\/[^\s<>"')\]]+/g;

    while (
        (match =
            urlRegex.exec(text)) !== null
    ) {

        const url =
            decodeURL(
                match[0]
            );

        const path =
            extractWikiPath(
                url
            );

        if (!path) {
            continue;
        }

        const name =
            cleanWeaponName(
                path
                    .replace(
                        /^ブキ\//,
                        ""
                    )
            );

        if (
            isValidWeapon(
                name,
                path
            )
        ) {

            result.push({
                name,
                url
            });
        }
    }


    /*
       -----------------------------------------------------
       パターン4
       attachref

       &attachref(icon/スプラシューター.png,...);
       スプラシューター
       -----------------------------------------------------
    */

    const attachRegex =
        /attachref\([^)]*?icon\/([^,);]+)[^)]*\)[^|;\n]*[;:]([^|\n]+)/gi;

    while (
        (match =
            attachRegex.exec(text)) !== null
    ) {

        let imageName =
            match[1];

        let name =
            cleanWeaponName(
                match[2]
            );

        if (
            !name ||
            name.length < 2
        ) {

            name =
                cleanWeaponName(
                    imageName
                        .replace(
                            /\.(png|jpg|jpeg|webp)$/i,
                            ""
                        )
                );
        }

        if (
            !name ||
            name.length < 2
        ) {
            continue;
        }

        const path =
            "ブキ/" +
            name;

        if (
            isLikelyWeaponName(
                name
            )
        ) {

            result.push(
                createWeapon(
                    name,
                    path
                )
            );
        }
    }


    /*
       -----------------------------------------------------
       仕上げ
       -----------------------------------------------------
    */

    return uniqueWeapons(
        result
    );
}


/* =========================================================
   CREATE WEAPON
========================================================= */

function createWeapon(
    name,
    path
) {

    const cleanPath =
        cleanPagePath(
            path
        );

    const url =
        WIKI_BASE +
        cleanPath
            .split("/")
            .map(
                part =>
                    encodeURIComponent(
                        part
                    )
            )
            .join("/");

    return {
        name,
        url
    };
}


/* =========================================================
   PAGE PATH
========================================================= */

function cleanPagePath(
    path
) {

    return decodeURL(
        String(path)
            .replace(
                /^https:\/\/wikiwiki\.jp\/splatoon3mix\//,
                ""
            )
            .replace(
                /^\/splatoon3mix\//,
                ""
            )
            .trim()
    );
}


/* =========================================================
   URL DECODE
========================================================= */

function decodeURL(
    value
) {

    try {

        return decodeURIComponent(
            value
        );

    } catch {

        return value;
    }
}


/* =========================================================
   EXTRACT PATH
========================================================= */

function extractWikiPath(
    url
) {

    const prefix =
        "https://wikiwiki.jp/splatoon3mix/";

    if (
        !url.startsWith(
            prefix
        )
    ) {

        return null;
    }

    return decodeURL(
        url.substring(
            prefix.length
        )
    );
}


/* =========================================================
   WEAPON VALIDATION
========================================================= */

function isValidWeapon(
    name,
    path
) {

    if (!name || !path) {
        return false;
    }

    if (
        !path.startsWith(
            "ブキ/"
        )
    ) {

        return false;
    }

    const page =
        path.substring(3);

    if (!page) {
        return false;
    }

    if (
        page.includes("属")
    ) {

        return false;
    }

    if (
        page.includes("一覧")
    ) {

        return false;
    }

    if (
        page.includes("概要")
    ) {

        return false;
    }

    if (
        page.includes("について")
    ) {

        return false;
    }

    if (
        name.includes("属について")
    ) {

        return false;
    }

    return true;
}


/* =========================================================
   LIKELY WEAPON NAME
========================================================= */

function isLikelyWeaponName(
    name
) {

    const excluded = [

        "メインウェポン",
        "サブウェポン",
        "スペシャルウェポン",
        "ブキ一覧",
        "ブキ性能",
        "性能比較",
        "概要",
        "について",
        "解説",
        "一覧",
        "その他",
        "更新履歴"

    ];

    for (
        const word of excluded
    ) {

        if (
            name.includes(word)
        ) {

            return false;
        }
    }

    return (
        name.length >= 2 &&
        name.length <= 40
    );
}


/* =========================================================
   CLEAN WEAPON NAME
========================================================= */

function cleanWeaponName(
    name
) {

    return String(name || "")

        .replace(
            /&br;/gi,
            " "
        )

        .replace(
            /<br\s*\/?>/gi,
            " "
        )

        .replace(
            /&color\([^)]*\)\{/gi,
            ""
        )

        .replace(
            /&size\([^)]*\)\{/gi,
            ""
        )

        .replace(
            /&ref\([^)]*\);/gi,
            ""
        )

        .replace(
            /&attachref\([^)]*\);/gi,
            ""
        )

        .replace(
            /\{\{/g,
            ""
        )

        .replace(
            /\}\}/g,
            ""
        )

        .replace(
            /^[;:|]+/,
            ""
        )

        .replace(
            /[;:|]+$/,
            ""
        )

        .replace(
            /\s+/g,
            " "
        )

        .trim();
}


/* =========================================================
   UNIQUE
========================================================= */

function uniqueWeapons(
    list
) {

    const map =
        new Map();

    for (
        const weapon of list
    ) {

        if (
            !weapon ||
            !weapon.name ||
            !weapon.url
        ) {

            continue;
        }

        if (
            map.has(
                weapon.url
            )
        ) {

            continue;
        }

        map.set(
            weapon.url,
            weapon
        );
    }

    return Array.from(
        map.values()
    );
}


/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {

    searchInput.addEventListener(
        "input",
        renderWeaponList
    );
}


/* =========================================================
   RENDER WEAPON LIST
========================================================= */

function renderWeaponList() {

    weaponList.innerHTML = "";

    const keyword =
        searchInput.value
            .trim()
            .toLowerCase();

    const filtered =
        weapons.filter(
            weapon => {

                if (!keyword) {
                    return true;
                }

                return weapon.name
                    .toLowerCase()
                    .includes(
                        keyword
                    );
            }
        );

    weaponCount.textContent =
        filtered.length;


    if (
        filtered.length === 0
    ) {

        if (
            weapons.length === 0
        ) {

            weaponList.innerHTML = `
                <div class="empty-list">

                    <div class="empty-icon">
                        +
                    </div>

                    <strong>
                        武器がありません
                    </strong>

                    <span>
                        上のカテゴリを選択してください
                    </span>

                </div>
            `;

        } else {

            weaponList.innerHTML = `
                <div class="empty-list">

                    <div class="empty-icon">
                        ⌕
                    </div>

                    <strong>
                        「${escapeHTML(
                            keyword
                        )}」が見つかりません
                    </strong>

                    <span>
                        別の名前で検索してください
                    </span>

                </div>
            `;
        }

        return;
    }


    filtered.forEach(
        weapon => {

            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.className =
                "weapon-item";

            button.innerHTML = `

                <div class="weapon-item-name">
                    ${escapeHTML(
                        weapon.name
                    )}
                </div>

                <div class="weapon-item-arrow">
                    ›
                </div>

            `;

            button.addEventListener(
                "click",
                () => {
                    selectWeapon(
                        weapon
                    );
                }
            );

            weaponList.appendChild(
                button
            );
        }
    );
}


/* =========================================================
   SELECT WEAPON
========================================================= */

async function selectWeapon(
    weapon
) {

    currentWeapon =
        weapon;

    weaponDetail.innerHTML = `

        <div class="loading-box">

            <strong>
                ${escapeHTML(
                    weapon.name
                )}
            </strong>

            <span>
                性能データを取得しています…
            </span>

        </div>
    `;

    setStatus(
        `${weapon.name}を取得中…`
    );


    /* ---------------------------------------------
       CACHE
    --------------------------------------------- */

    try {

        const cached =
            await getCachedWeapon(
                weapon.url
            );

        if (cached) {

            console.log(
                "CACHE:",
                weapon.name
            );

            renderWeaponDetail(
                cached
            );

            setStatus(
                `${weapon.name}：キャッシュ`
            );

            scrollToDetail();

            return;
        }

    } catch (error) {

        console.warn(
            "Cache read error:",
            error
        );
    }


    /* ---------------------------------------------
       FETCH
    --------------------------------------------- */

    try {

        const text =
            await fetchWiki(
                weapon.url
            );

        const data =
            parseWeaponPage(
                text,
                weapon
            );

        await saveCachedWeapon(
            data
        );

        renderWeaponDetail(
            data
        );

        setStatus(
            `${weapon.name}：取得完了`
        );

        scrollToDetail();

    } catch (error) {

        console.error(error);

        weaponDetail.innerHTML = `

            <div class="error-box">

                <strong>
                    性能データの取得に失敗しました
                </strong>

                <span>
                    ${escapeHTML(
                        error.message
                    )}
                </span>

                <button
                    type="button"
                    class="category-button"
                    id="retryWeapon"
                    style="margin-top:18px;"
                >
                    再取得
                </button>

            </div>
        `;

        document
            .getElementById(
                "retryWeapon"
            )
            ?.addEventListener(
                "click",
                () => {

                    selectWeapon(
                        weapon
                    );
                }
            );

        setStatus(
            "取得失敗"
        );
    }
}


/* =========================================================
   PARSE WEAPON PAGE
========================================================= */

function parseWeaponPage(
    text,
    weapon
) {

    const clean =
        normalizeSourceText(
            text
        );

    const data = {

        name:
            weapon.name,

        url:
            weapon.url,

        sub:
            findField(
                clean,
                [
                    "サブウェポン",
                    "サブ"
                ]
            ),

        special:
            findField(
                clean,
                [
                    "スペシャルウェポン",
                    "スペシャル"
                ]
            ),

        points:
            findNumber(
                clean,
                [
                    "必要ポイント",
                    "必要P"
                ]
            ),

        range:
            findNumber(
                clean,
                [
                    "有効射程"
                ]
            ),

        paintRange:
            findNumber(
                clean,
                [
                    "塗り射程"
                ]
            ),

        damage:
            findDamage(
                clean
            ),

        kills:
            findField(
                clean,
                [
                    "確定数"
                ]
            ),

        fireFrames:
            findNumber(
                clean,
                [
                    "連射フレーム"
                ]
            ),

        shotsPerSecond:
            findNumber(
                clean,
                [
                    "秒間発射数"
                ]
            ),

        killTime:
            findNumber(
                clean,
                [
                    "キルタイム"
                ]
            ),

        dps:
            findNumber(
                clean,
                [
                    "DPS"
                ]
            ),

        spread:
            findNumber(
                clean,
                [
                    "拡散"
                ]
            ),

        jumpSpread:
            findNumber(
                clean,
                [
                    "ジャンプ中拡散"
                ]
            ),

        reticleRange:
            findNumber(
                clean,
                [
                    "レティクル反応距離"
                ]
            ),

        blastRadius:
            findNumber(
                clean,
                [
                    "爆風半径",
                    "爆風範囲"
                ]
            ),

        blastDamage:
            findNumber(
                clean,
                [
                    "爆風ダメージ"
                ]
            ),

        directDamage:
            findNumber(
                clean,
                [
                    "直撃ダメージ"
                ]
            ),

        damageRange:
            findNumber(
                clean,
                [
                    "ダメージ射程"
                ]
            ),

        weight:
            findField(
                clean,
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
   NORMALIZE SOURCE
========================================================= */

function normalizeSourceText(
    text
) {

    return String(text || "")

        .replace(
            /\r/g,
            ""
        )

        .replace(
            /&br;/gi,
            " "
        )

        .replace(
            /<br\s*\/?>/gi,
            " "
        )

        .replace(
            /\s+/g,
            " "
        );
}


/* =========================================================
   FIELD
========================================================= */

function findField(
    text,
    labels
) {

    for (
        const label of labels
    ) {

        const index =
            text.indexOf(
                label
            );

        if (
            index === -1
        ) {

            continue;
        }

        let value =
            text.substring(
                index +
                label.length,
                index +
                label.length +
                100
            );

        value =
            value
                .replace(
                    /^[\s|:：]+/,
                    ""
                )
                .split(
                    "|"
                )[0]
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

function findNumber(
    text,
    labels
) {

    const value =
        findField(
            text,
            labels
        );

    const match =
        value.match(
            /-?\d+(?:\.\d+)?/
        );

    if (!match) {

        return null;
    }

    return Number(
        match[0]
    );
}


/* =========================================================
   DAMAGE
========================================================= */

function findDamage(
    text
) {

    const value =
        findField(
            text,
            [
                "ダメージ"
            ]
        );

    const numbers =
        value.match(
            /\d+(?:\.\d+)?/g
        );

    if (
        !numbers ||
        numbers.length === 0
    ) {

        return {

            max: null,

            min: null,

            raw: "—"
        };
    }

    const values =
        numbers.map(
            Number
        );

    return {

        max:
            Math.max(
                ...values
            ),

        min:
            Math.min(
                ...values
            ),

        raw:
            value
    };
}


/* =========================================================
   DETAIL RENDER
========================================================= */

function renderWeaponDetail(
    data
) {

    weaponDetail.innerHTML = `

        <div class="detail-header">

            <div>

                <div class="detail-kicker">
                    WEAPON
                </div>

                <h2>
                    ${escapeHTML(
                        data.name
                    )}
                </h2>

            </div>

            <button
                type="button"
                class="cache-delete"
                id="deleteCache"
            >
                キャッシュ削除
            </button>

        </div>


        <!-- BASIC -->

        <section class="detail-card">

            <h3>
                基本情報
            </h3>

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
                    formatValue(
                        data.points,
                        "p"
                    )
                )}

                ${stat(
                    "ブキ重量",
                    data.weight
                )}

            </div>

        </section>


        <!-- RANGE -->

        <section class="detail-card">

            <h3>
                射程
            </h3>

            <div class="range-number">

                ${
                    data.range !== null
                        ? data.range.toFixed(1)
                        : "—"
                }

                <span>
                    m
                </span>

            </div>

            ${createRangeGraph(
                data
            )}

        </section>


        <!-- DAMAGE -->

        <section class="detail-card">

            <h3>
                ダメージ
            </h3>

            <div class="damage-values">

                <div>

                    <strong>
                        ${
                            data.damage?.max ??
                            "—"
                        }
                    </strong>

                    <span>
                        最大ダメージ
                    </span>

                </div>

                <div>

                    <strong>
                        ${
                            data.damage?.min ??
                            "—"
                        }
                    </strong>

                    <span>
                        最小ダメージ
                    </span>

                </div>

            </div>

            ${createDamageGraph(
                data
            )}

        </section>


        <!-- FALLOFF -->

        <section class="detail-card">

            <h3>
                距離減衰
            </h3>

            ${createFalloffGraph(
                data
            )}

        </section>


        ${
            hasBlast(
                data
            )
                ? `

                    <section class="detail-card">

                        <h3>
                            爆風範囲
                        </h3>

                        ${createBlastGraph(
                            data
                        )}

                    </section>

                  `
                : ""
        }


        <!-- PERFORMANCE -->

        <section class="detail-card">

            <h3>
                性能
            </h3>

            <div class="stat-grid">

                ${stat(
                    "確定数",
                    data.kills
                )}

                ${stat(
                    "キルタイム",
                    data.killTime !== null
                        ? `${data.killTime}秒`
                        : "—"
                )}

                ${stat(
                    "連射フレーム",
                    formatValue(
                        data.fireFrames,
                        "F"
                    )
                )}

                ${stat(
                    "秒間発射数",
                    formatValue(
                        data.shotsPerSecond,
                        "発/秒"
                    )
                )}

                ${stat(
                    "DPS",
                    data.dps
                )}

                ${stat(
                    "拡散",
                    data.spread !== null
                        ? `${data.spread}°`
                        : "—"
                )}

                ${stat(
                    "ジャンプ中拡散",
                    data.jumpSpread !== null
                        ? `${data.jumpSpread}°`
                        : "—"
                )}

                ${stat(
                    "レティクル反応距離",
                    data.reticleRange !== null
                        ? `${data.reticleRange}m`
                        : "—"
                )}

            </div>

        </section>


        <!-- SOURCE -->

        <div class="source-card">

            <span>
                データ：WikiWiki.jp / splatoon3mix
            </span>

            <a
                href="${escapeAttribute(
                    data.url
                )}"
                target="_blank"
                rel="noopener noreferrer"
            >
                WikiWikiで詳細を見る
            </a>

        </div>

    `;


    document
        .getElementById(
            "deleteCache"
        )
        ?.addEventListener(
            "click",
            async () => {

                await deleteCachedWeapon(
                    data.url
                );

                setStatus(
                    `${data.name}のキャッシュを削除`
                );

                alert(
                    "このブキのキャッシュを削除しました。"
                );
            }
        );
}


/* =========================================================
   STAT HTML
========================================================= */

function stat(
    label,
    value
) {

    return `

        <div class="stat">

            <span>
                ${escapeHTML(
                    label
                )}
            </span>

            <strong>
                ${escapeHTML(
                    value === null ||
                    value === undefined ||
                    value === ""
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

function createRangeGraph(
    data
) {

    const range =
        Number(
            data.range
        ) || 0;

    const paint =
        Number(
            data.paintRange
        ) || 0;

    const blast =
        Number(
            data.blastRadius
        ) || 0;

    const max =
        Math.max(
            6,
            range,
            paint
        );

    const rangeWidth =
        Math.min(
            100,
            range /
            max *
            100
        );

    const paintWidth =
        Math.min(
            100,
            paint /
            max *
            100
        );


    let blastHTML = "";

    if (
        blast > 0 &&
        range > 0
    ) {

        const circleSize =
            Math.max(
                30,
                Math.min(
                    130,
                    blast * 70
                )
            );

        blastHTML = `

            <div
                class="blast-endpoint"
                style="
                    left:${rangeWidth}%;
                "
            >

                <div
                    class="blast-endpoint-circle"
                    style="
                        width:${circleSize}px;
                        height:${circleSize}px;
                    "
                ></div>

            </div>
        `;
    }


    return `

        <div class="range-graph">

            <div class="range-track">

                <div
                    class="range-paint"
                    style="
                        width:${paintWidth}%;
                    "
                ></div>

                <div
                    class="range-main"
                    style="
                        width:${rangeWidth}%;
                    "
                ></div>

                ${blastHTML}

            </div>

            <div class="range-scale">

                <span>
                    0m
                </span>

                <span>
                    ${max.toFixed(1)}m
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

                ${
                    blast > 0
                        ? `
                            <span>
                                ○ 爆風半径
                            </span>
                          `
                        : ""
                }

            </div>

        </div>

    `;
}


/* =========================================================
   DAMAGE GRAPH
========================================================= */

function createDamageGraph(
    data
) {

    const max =
        data.damage?.max;

    const min =
        data.damage?.min;

    if (
        max === null ||
        max === undefined
    ) {

        return `
            <div class="empty-list">
                ダメージデータなし
            </div>
        `;
    }

    const low =
        min ??
        max;

    const minWidth =
        Math.max(
            0,
            Math.min(
                100,
                low / max * 100
            )
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
                        style="
                            width:100%;
                        "
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
                        style="
                            width:${minWidth}%;
                        "
                    ></div>

                </div>

                <strong>
                    ${low}
                </strong>

            </div>

        </div>

    `;
}


/* =========================================================
   FALLOFF GRAPH
========================================================= */

function createFalloffGraph(
    data
) {

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
            <div class="empty-list">
                距離減衰データなし
            </div>
        `;
    }

    const low =
        min ??
        max;


    /*
       現時点では
       最大ダメージ → 最小ダメージ
       の減衰を視覚化する。

       WikiWikiに実測ポイントが存在する
       武器については今後より細かくできる。
    */

    const points = [];

    for (
        let i = 0;
        i <= 10;
        i++
    ) {

        const x =
            12 +
            i *
            31.6;

        const ratio =
            i / 10;

        const y =
            28 +
            ratio *
            145;

        points.push(
            `${x},${y}`
        );
    }


    return `

        <div class="falloff-chart">

            <svg
                viewBox="0 0 328 200"
                preserveAspectRatio="none"
                aria-label="距離減衰グラフ"
            >

                <polyline
                    points="${points.join(" ")}"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
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

            <span>
                近距離
            </span>

            <span>
                最大射程 ${Number(range).toFixed(1)}m
            </span>

            <span>
                遠距離
            </span>

        </div>

    `;
}


/* =========================================================
   BLAST
========================================================= */

function hasBlast(
    data
) {

    return (
        data.blastRadius !== null &&
        Number(
            data.blastRadius
        ) > 0
    );
}


function createBlastGraph(
    data
) {

    const radius =
        Number(
            data.blastRadius
        );

    const size =
        Math.max(
            90,
            Math.min(
                220,
                radius * 170
            )
        );

    return `

        <div class="blast-graph">

            <div
                class="blast-circle"
                style="
                    width:${size}px;
                    height:${size}px;
                "
            ></div>

            <div class="blast-info">

                <strong>
                    ${radius}m
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

                ${
                    data.directDamage !== null
                        ? `
                            <span>
                                直撃ダメージ：
                                ${data.directDamage}
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

function openDatabase() {

    if (dbPromise) {

        return dbPromise;
    }

    dbPromise =
        new Promise(
            (
                resolve,
                reject
            ) => {

                if (
                    !("indexedDB" in window)
                ) {

                    reject(
                        new Error(
                            "IndexedDBが利用できません"
                        )
                    );

                    return;
                }

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
                            !db.objectStoreNames.contains(
                                STORE_NAME
                            )
                        ) {

                            db.createObjectStore(
                                STORE_NAME,
                                {
                                    keyPath:
                                        "url"
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

    return dbPromise;
}


/* =========================================================
   CACHE GET
========================================================= */

async function getCachedWeapon(
    url
) {

    const db =
        await openDatabase();

    return new Promise(
        (
            resolve,
            reject
        ) => {

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
                store.get(
                    url
                );

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


/* =========================================================
   CACHE SAVE
========================================================= */

async function saveCachedWeapon(
    data
) {

    const db =
        await openDatabase();

    return new Promise(
        (
            resolve,
            reject
        ) => {

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
                store.put(
                    data
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


/* =========================================================
   CACHE DELETE
========================================================= */

async function deleteCachedWeapon(
    url
) {

    const db =
        await openDatabase();

    return new Promise(
        (
            resolve,
            reject
        ) => {

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
                store.delete(
                    url
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


/* =========================================================
   FORMAT
========================================================= */

function formatValue(
    value,
    suffix = ""
) {

    if (
        value === null ||
        value === undefined ||
        Number.isNaN(
            Number(value)
        )
    ) {

        return "—";
    }

    return (
        String(value) +
        suffix
    );
}


/* =========================================================
   SCROLL
========================================================= */

function scrollToDetail() {

    setTimeout(
        () => {

            weaponDetail.scrollIntoView(
                {
                    behavior:
                        "smooth",
                    block:
                        "start"
                }
            );

        },
        100
    );
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}


/* =========================================================
   ESCAPE ATTRIBUTE
========================================================= */

function escapeAttribute(
    value
) {

    return escapeHTML(
        value
    );
}
