const { NextResponse } = require('next/server');
const { apiHandler } = require('../../../lib/utils/apiHandler');
const Pet = require('../../../lib/models/Pet');

const GET = apiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const species = searchParams.get('species');
  const donorStatus = searchParams.get('donorStatus');
  const filter = {};
  if (species) filter.species = species;
  if (donorStatus) filter.donorStatus = donorStatus;
  const pets = await Pet.find(filter).populate('owner').sort({ createdAt: -1 }).limit(100);
  return NextResponse.json({ pets });
});

const POST = apiHandler(async (req) => {
  const body = await req.json();
  const pet = await Pet.create(body);
  return NextResponse.json({ pet }, { status: 201 });
});

module.exports = { GET, POST };
