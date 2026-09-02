const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const PetParent = require('../models/PetParent');

const list = apiHandler(async () => {
  const petParents = await PetParent.find({ deletedAt: null }).sort({ createdAt: -1 }).limit(100);
  return NextResponse.json({ petParents });
});

const create = apiHandler(async (req) => {
  const body = await req.json();
  const petParent = await PetParent.create(body);
  return NextResponse.json({ petParent }, { status: 201 });
});

const get = apiHandler(async (req, { params }) => {
  const petParent = await PetParent.findById(params.id);
  if (!petParent) return NextResponse.json({ error: 'PetParent not found' }, { status: 404 });
  return NextResponse.json({ petParent });
});

const update = apiHandler(async (req, { params }) => {
  const body = await req.json();
  const petParent = await PetParent.findByIdAndUpdate(params.id, body, { new: true, runValidators: true });
  if (!petParent) return NextResponse.json({ error: 'PetParent not found' }, { status: 404 });
  return NextResponse.json({ petParent });
});

module.exports = { list, create, get, update };
