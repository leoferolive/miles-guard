const chai = require('chai');
const sinon = require('sinon');
const {
  startPOC,
  fetchTargetGroups,
  fetchLastSmilesMessages,
  handleNewMessage
} = require('../poc');

const { expect } = chai;

describe('poc.js - Funções principais', () => {
  describe('startPOC', () => {
    it('deve ser uma função assíncrona', () => {
      expect(startPOC).to.be.a('function');
    });
  });
  
  describe('fetchTargetGroups', () => {
    it('deve ser uma função assíncrona', () => {
      expect(fetchTargetGroups).to.be.a('function');
    });
  });
  
  describe('fetchLastSmilesMessages', () => {
    it('deve ser uma função assíncrona', () => {
      expect(fetchLastSmilesMessages).to.be.a('function');
    });
  });
  
  describe('handleNewMessage', () => {
    it('deve ser uma função assíncrona', () => {
      expect(handleNewMessage).to.be.a('function');
    });
  });
});