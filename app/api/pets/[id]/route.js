const { NextResponse } = require('next/server');
const { apiHandler } = require('../../../../lib/utils/apiHandler');
const Pet = require('../../../../lib/models/Pet');

const GET = apiHandler(async (req, { params }) => {
  const { id } = await params;
  const pet = await Pet.findById(id).populate('owner');
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
  return NextResponse.json({ pet });
});

const PATCH = apiHandler(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  const pet = await Pet.findByIdAndUpdate(id, body, { new: true, runValidators: true });
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
  return NextResponse.json({ pet });
});

module.exports = { GET, PATCH };
