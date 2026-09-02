const { NextResponse } = require('next/server');

async function GET() {
  return NextResponse.json({ status: 'ok' });
}

module.exports = { GET };
