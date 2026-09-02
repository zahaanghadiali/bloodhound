const { NextResponse } = require('next/server');
const { apiHandler } = require('../../../../lib/utils/apiHandler');
const PetParent = require('../../../../lib/models/PetParent');

const GET = apiHandler(async (req, { params }) => {
  const { id } = await params;
  const petParent = await PetParent.findById(id);
  if (!petParent) return NextResponse.json({ error: 'PetParent not found' }, { status: 404 });
  return NextResponse.json({ petParent });
});

const PATCH = apiHandler(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  const petParent = await PetParent.findByIdAndUpdate(id, body, { new: true, runValidators: true });
  if (!petParent) return NextResponse.json({ error: 'PetParent not found' }, { status: 404 });
  return NextResponse.json({ petParent });
});

module.exports = { GET, PATCH };
