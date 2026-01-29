import { describe, expect, it } from 'vitest'
import { splitCommaSeparated } from './string-utils.js'

describe('splitCommaSeparated', () => {
  describe('returns undefined for empty inputs', () => {
    it('should return undefined for undefined input', () => {
      // Arrange
      const input = undefined

      // Act
      const result = splitCommaSeparated(input)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should return undefined for empty string', () => {
      // Arrange
      const input = ''

      // Act
      const result = splitCommaSeparated(input)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should return undefined for whitespace-only string', () => {
      // Arrange
      const input = '   '

      // Act
      const result = splitCommaSeparated(input)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should return undefined for comma-only string', () => {
      // Arrange
      const input = ',,,'

      // Act
      const result = splitCommaSeparated(input)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should return undefined for commas with whitespace', () => {
      // Arrange
      const input = ' , , , '

      // Act
      const result = splitCommaSeparated(input)

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('parses valid comma-separated strings', () => {
    it('should parse single value', () => {
      // Arrange
      const input = 'frontend'

      // Act
      const result = splitCommaSeparated(input)

      // Assert
      expect(result).toEqual(['frontend'])
    })

    it('should parse multiple values', () => {
      // Arrange
      const input = 'frontend,backend,api'

      // Act
      const result = splitCommaSeparated(input)

      // Assert
      expect(result).toEqual(['frontend', 'backend', 'api'])
    })

    it('should trim whitespace from values', () => {
      // Arrange
      const input = ' frontend , backend , api '

      // Act
      const result = splitCommaSeparated(input)

      // Assert
      expect(result).toEqual(['frontend', 'backend', 'api'])
    })

    it('should filter out empty values between commas', () => {
      // Arrange
      const input = 'frontend,,backend,,,api'

      // Act
      const result = splitCommaSeparated(input)

      // Assert
      expect(result).toEqual(['frontend', 'backend', 'api'])
    })

    it('should handle mixed whitespace and empty values', () => {
      // Arrange
      const input = '  frontend  ,  , backend,  ,api  '

      // Act
      const result = splitCommaSeparated(input)

      // Assert
      expect(result).toEqual(['frontend', 'backend', 'api'])
    })

    it('should handle tags with special characters', () => {
      // Arrange
      const input = 'node-18,typescript-5.0,@scope/pkg'

      // Act
      const result = splitCommaSeparated(input)

      // Assert
      expect(result).toEqual(['node-18', 'typescript-5.0', '@scope/pkg'])
    })
  })
})
