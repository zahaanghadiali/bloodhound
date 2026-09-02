const { NextResponse } = require('next/server');

const check = async () => NextResponse.json({ status: 'ok' });

module.exports = { check };
