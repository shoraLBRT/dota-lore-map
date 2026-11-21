// Функция обратной связи (#75, по образцу Transliterator): принимает отзыв с карты и заводит issue.
// Страница статическая и токена GitHub держать не может — его забрал бы любой, кто откроет её код.
// Токен живёт здесь, а страница присылает готовые заголовок, текст и метки: формат issue задаёт
// страница (src/features/feedback/message.ts), и он один на оба пути отправки — ссылкой на форму
// GitHub и через эту функцию.

import { ALLOWED_LABELS, FEEDBACK_LABEL, MAX_BODY_LENGTH, MAX_TITLE_LENGTH } from "./contract.js";
import { createIssue } from "./github.js";

export { MAX_BODY_LENGTH, MAX_TITLE_LENGTH };

/** Запрос крупнее заведомо не от страницы — его не стоит и разбирать. */
const MAX_REQUEST_BYTES = 64 * 1024;

/** Невидимый пробел нулевой ширины: им разрывается упоминание (`defuse`). */
export const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export default {
    fetch: (request, env) => handle(request, env, globalThis.fetch),
};

export async function handle(request, env, fetchImpl) {
    const origin = request.headers.get("Origin");
    const allowed = allowedOrigins(env);

    // Чужому сайту функция не отвечает вовсе: без заголовков CORS браузер
    // не отдаст ответ его скрипту, а запрос без Origin — не из браузера.
    if (!origin || !allowed.includes(origin))
        return json({ error: "origin" }, 403);

    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers: cors });

    if (request.method !== "POST")
        return json({ error: "method" }, 405, cors);

    const ip = request.headers.get("CF-Connecting-IP") ?? "";

    // Лимит — сверх Turnstile: проверку проходит и человек, который жмёт
    // «Отправить» без конца. Привязки может не быть (локальный запуск, тесты).
    if (env.FEEDBACK_LIMITER) {
        const { success } = await env.FEEDBACK_LIMITER.limit({ key: ip || "unknown" });
        if (!success)
            return json({ error: "rate" }, 429, cors);
    }

    const input = await readInput(request);
    if (!input)
        return json({ error: "input" }, 400, cors);

    if (!(await humanVerified(env, input.token, ip, fetchImpl)))
        return json({ error: "captcha" }, 403, cors);

    try {
        const issue = await createIssue(env, defuse(input.title), defuse(input.body), input.labels, fetchImpl);
        return json(issue, 201, cors);
    } catch (error) {
        console.error(error);
        return json({ error: "github" }, 502, cors);
    }
}

async function readInput(request) {
    const declared = Number(request.headers.get("Content-Length") ?? 0);
    if (declared > MAX_REQUEST_BYTES)
        return null;

    let data;
    try {
        const text = await request.text();
        if (text.length > MAX_REQUEST_BYTES)
            return null;
        data = JSON.parse(text);
    } catch {
        return null;
    }

    const { title, body, token, labels } = data ?? {};
    if (typeof title !== "string" || typeof body !== "string" || typeof token !== "string")
        return null;

    if (title.trim() === "" || title.length > MAX_TITLE_LENGTH)
        return null;
    if (body.trim() === "" || body.length > MAX_BODY_LENGTH)
        return null;
    if (token === "")
        return null;
    if (labels !== undefined && !(Array.isArray(labels) && labels.every(label => typeof label === "string")))
        return null;

    return { title, body, token, labels: issueLabels(labels ?? []) };
}

/**
 * Метки issue: `feedback` всегда, из присланных — только известные (`content-fix` у отзыва о блоке).
 * Метку, которой в репозитории нет, GitHub создал бы сам — страница не должна плодить метки.
 */
export function issueLabels(requested) {
    const labels = [FEEDBACK_LABEL, ...requested.filter(label => ALLOWED_LABELS.includes(label))];
    return [...new Set(labels)];
}

async function humanVerified(env, token, ip, fetchImpl) {
    const form = new FormData();
    form.append("secret", env.TURNSTILE_SECRET);
    form.append("response", token);
    if (ip)
        form.append("remoteip", ip);

    try {
        const response = await fetchImpl(SITEVERIFY, { method: "POST", body: form });
        const result = await response.json();
        // Причина отказа (коды Turnstile, не секрет) — в журнал функции: `wrangler tail`.
        if (result.success !== true)
            console.warn("turnstile", JSON.stringify({ codes: result["error-codes"], hostname: result.hostname }));
        return result.success === true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

/**
 * Упоминание `@кто-то` в issue шлёт этому человеку уведомление, а `@org/team`
 * — целой команде. Текст пишет кто угодно, и функция не должна быть рассылкой:
 * после `@` встаёт невидимый пробел нулевой ширины, и GitHub ссылки не делает.
 */
export function defuse(text) {
    return text.replace(/@(?=[A-Za-z0-9])/g, `@${ZERO_WIDTH_SPACE}`);
}

function allowedOrigins(env) {
    return (env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map(origin => origin.trim())
        .filter(origin => origin !== "");
}

function corsHeaders(origin) {
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
    };
}

function json(data, status, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
    });
}
