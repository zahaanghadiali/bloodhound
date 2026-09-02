const { NextResponse } = require('next/server');
const { apiHandler } = require('../utils/apiHandler');
const Pet = require('../models/Pet');

const list = apiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const species = searchParams.get('species');
  const donorStatus = searchParams.get('donorStatus');
  const filter = {};
  if (species) filter.species = species;
  if (donorStatus) filter.donorStatus = donorStatus;
  const pets = await Pet.find(filter).populate('owner').sort({ createdAt: -1 }).limit(100);
  return NextResponse.json({ pets });
});

const create = apiHandler(async (req) => {
  const body = await req.json();
  const pet = await Pet.create(body);
  return NextResponse.json({ pet }, { status: 201 });
});

const get = apiHandler(async (req, { params }) => {
  const pet = await Pet.findById(params.id).populate('owner');
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
  return NextResponse.json({ pet });
});

const update = apiHandler(async (req, { params }) => {
  const body = await req.json();
  const pet = await Pet.findByIdAndUpdate(params.id, body, { new: true, runValidators: true });
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
  return NextResponse.json({ pet });
});

module.exports = { list, create, get, update };
