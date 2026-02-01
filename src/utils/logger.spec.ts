import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from './logger.js'

describe('logger', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Reset to default level
    logger.setLevel('info')
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('setLevel', () => {
    it('should set log level to debug', () => {
      logger.setLevel('debug')
      logger.debug('test message')
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should set log level to warn', () => {
      logger.setLevel('warn')
      logger.info('should not appear')
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('should set log level to error', () => {
      logger.setLevel('error')
      logger.warn('should not appear')
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
  })

  describe('debug', () => {
    it('should log when level is debug', () => {
      logger.setLevel('debug')
      logger.debug('debug message')
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] debug message'),
      )
    })

    it('should not log when level is info', () => {
      logger.setLevel('info')
      logger.debug('debug message')
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('should include data when provided', () => {
      logger.setLevel('debug')
      logger.debug('message', { key: 'value' })
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('{"key":"value"}'),
      )
    })
  })

  describe('info', () => {
    it('should log when level is info', () => {
      logger.setLevel('info')
      logger.info('info message')
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] info message'),
      )
    })

    it('should log when level is debug', () => {
      logger.setLevel('debug')
      logger.info('info message')
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should not log when level is warn', () => {
      logger.setLevel('warn')
      logger.info('info message')
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('should include data when provided', () => {
      logger.info('message', { count: 42 })
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('{"count":42}'),
      )
    })
  })

  describe('warn', () => {
    it('should log when level is warn', () => {
      logger.setLevel('warn')
      logger.warn('warn message')
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] warn message'),
      )
    })

    it('should log when level is info', () => {
      logger.setLevel('info')
      logger.warn('warn message')
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should not log when level is error', () => {
      logger.setLevel('error')
      logger.warn('warn message')
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('should include data when provided', () => {
      logger.warn('warning', { issue: 'test' })
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('{"issue":"test"}'),
      )
    })
  })

  describe('error', () => {
    it('should log when level is error', () => {
      logger.setLevel('error')
      logger.error('error message')
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] error message'),
      )
    })

    it('should always log regardless of level', () => {
      logger.setLevel('error')
      logger.error('error message')
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should include data when provided', () => {
      logger.error('failed', { code: 500 })
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('{"code":500}'),
      )
    })
  })

  describe('format', () => {
    it('should include timestamp in ISO format', () => {
      logger.info('test')
      const call = consoleErrorSpy.mock.calls[0][0]
      // Check for ISO timestamp pattern
      expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should format message without data', () => {
      logger.info('simple message')
      const call = consoleErrorSpy.mock.calls[0][0]
      expect(call).toContain('[INFO] simple message')
      expect(call).not.toContain('undefined')
    })
  })
})
