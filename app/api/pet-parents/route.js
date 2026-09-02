const { NextResponse } = require('next/server');
const { apiHandler } = require('../../../lib/utils/apiHandler');
const PetParent = require('../../../lib/models/PetParent');

const GET = apiHandler(async () => {
  const petParents = await PetParent.find({ deletedAt: null }).sort({ createdAt: -1 }).limit(100);
  return NextResponse.json({ petParents });
});

const POST = apiHandler(async (req) => {
  const body = await req.json();
  const petParent = await PetParent.create(body);
  return NextResponse.json({ petParent }, { status: 201 });
});

module.exports = { GET, POST };
