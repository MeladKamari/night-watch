using System.Text;

namespace NightWatch.BuildingBlocks.Hashing;

/// <summary>
/// MurmurHash3 x64 128-bit — parity with FingerprintJS OSS / <c>@thenightwatch/core</c> <c>x64hash128</c>.
/// </summary>
public static class MurmurHash3X64
{
    private static readonly int[] F1 = [unchecked((int)0xff51afd7), unchecked((int)0xed558ccd)];
    private static readonly int[] F2 = [unchecked((int)0xc4ceb9fe), 0x1a85ec53];
    private static readonly int[] C1 = [unchecked((int)0x87c37b91), 0x114253d5];
    private static readonly int[] C2 = [0x4cf5ad43, 0x2745937f];
    private static readonly int[] M = [0, 5];
    private static readonly int[] N1 = [0, 0x52dce729];
    private static readonly int[] N2 = [0, 0x38495ab5];

    public static string Hash128(string input, int seed = 0)
    {
        var key = GetUtf8Bytes(input);
        var length = new[] { 0, key.Length };
        var remainder = length[1] % 16;
        var bytes = length[1] - remainder;
        var h1 = new[] { 0, seed };
        var h2 = new[] { 0, seed };
        var k1 = new[] { 0, 0 };
        var k2 = new[] { 0, 0 };

        int i;
        for (i = 0; i < bytes; i += 16)
        {
            k1[0] = ByteAt(key, i + 4) | (ByteAt(key, i + 5) << 8) | (ByteAt(key, i + 6) << 16) | (ByteAt(key, i + 7) << 24);
            k1[1] = ByteAt(key, i) | (ByteAt(key, i + 1) << 8) | (ByteAt(key, i + 2) << 16) | (ByteAt(key, i + 3) << 24);
            k2[0] = ByteAt(key, i + 12) | (ByteAt(key, i + 13) << 8) | (ByteAt(key, i + 14) << 16) | (ByteAt(key, i + 15) << 24);
            k2[1] = ByteAt(key, i + 8) | (ByteAt(key, i + 9) << 8) | (ByteAt(key, i + 10) << 16) | (ByteAt(key, i + 11) << 24);

            X64Multiply(k1, C1);
            X64Rotl(k1, 31);
            X64Multiply(k1, C2);
            X64Xor(h1, k1);
            X64Rotl(h1, 27);
            X64Add(h1, h2);
            X64Multiply(h1, M);
            X64Add(h1, N1);
            X64Multiply(k2, C2);
            X64Rotl(k2, 33);
            X64Multiply(k2, C1);
            X64Xor(h2, k2);
            X64Rotl(h2, 31);
            X64Add(h2, h1);
            X64Multiply(h2, M);
            X64Add(h2, N2);
        }

        k1[0] = 0;
        k1[1] = 0;
        k2[0] = 0;
        k2[1] = 0;
        var val = new[] { 0, 0 };

        if (remainder >= 15) { val[1] = ByteAt(key, i + 14); X64LeftShift(val, 48); X64Xor(k2, val); }
        if (remainder >= 14) { val[1] = ByteAt(key, i + 13); X64LeftShift(val, 40); X64Xor(k2, val); }
        if (remainder >= 13) { val[1] = ByteAt(key, i + 12); X64LeftShift(val, 32); X64Xor(k2, val); }
        if (remainder >= 12) { val[1] = ByteAt(key, i + 11); X64LeftShift(val, 24); X64Xor(k2, val); }
        if (remainder >= 11) { val[1] = ByteAt(key, i + 10); X64LeftShift(val, 16); X64Xor(k2, val); }
        if (remainder >= 10) { val[1] = ByteAt(key, i + 9); X64LeftShift(val, 8); X64Xor(k2, val); }
        if (remainder >= 9)
        {
            val[1] = ByteAt(key, i + 8);
            X64Xor(k2, val);
            X64Multiply(k2, C2);
            X64Rotl(k2, 33);
            X64Multiply(k2, C1);
            X64Xor(h2, k2);
        }
        if (remainder >= 8) { val[1] = ByteAt(key, i + 7); X64LeftShift(val, 56); X64Xor(k1, val); }
        if (remainder >= 7) { val[1] = ByteAt(key, i + 6); X64LeftShift(val, 48); X64Xor(k1, val); }
        if (remainder >= 6) { val[1] = ByteAt(key, i + 5); X64LeftShift(val, 40); X64Xor(k1, val); }
        if (remainder >= 5) { val[1] = ByteAt(key, i + 4); X64LeftShift(val, 32); X64Xor(k1, val); }
        if (remainder >= 4) { val[1] = ByteAt(key, i + 3); X64LeftShift(val, 24); X64Xor(k1, val); }
        if (remainder >= 3) { val[1] = ByteAt(key, i + 2); X64LeftShift(val, 16); X64Xor(k1, val); }
        if (remainder >= 2) { val[1] = ByteAt(key, i + 1); X64LeftShift(val, 8); X64Xor(k1, val); }
        if (remainder >= 1)
        {
            val[1] = ByteAt(key, i);
            X64Xor(k1, val);
            X64Multiply(k1, C1);
            X64Rotl(k1, 31);
            X64Multiply(k1, C2);
            X64Xor(h1, k1);
        }

        X64Xor(h1, length);
        X64Xor(h2, length);
        X64Add(h1, h2);
        X64Add(h2, h1);
        X64Fmix(h1);
        X64Fmix(h2);
        X64Add(h1, h2);
        X64Add(h2, h1);

        return $"{(uint)h1[0]:x8}{(uint)h1[1]:x8}{(uint)h2[0]:x8}{(uint)h2[1]:x8}";
    }

    private static byte[] GetUtf8Bytes(string input)
    {
        for (var i = 0; i < input.Length; i++)
        {
            if (input[i] > 127)
            {
                return Encoding.UTF8.GetBytes(input);
            }
        }

        var ascii = new byte[input.Length];
        for (var i = 0; i < input.Length; i++)
        {
            ascii[i] = (byte)input[i];
        }

        return ascii;
    }

    private static int ByteAt(byte[] key, int index) => index < key.Length ? key[index] : 0;

    private static void X64Add(int[] m, int[] n)
    {
        var m0 = (m[0] >>> 16) & 0xffff;
        var m1 = m[0] & 0xffff;
        var m2 = (m[1] >>> 16) & 0xffff;
        var m3 = m[1] & 0xffff;
        var n0 = (n[0] >>> 16) & 0xffff;
        var n1 = n[0] & 0xffff;
        var n2 = (n[1] >>> 16) & 0xffff;
        var n3 = n[1] & 0xffff;
        var o0 = 0;
        var o1 = 0;
        var o2 = 0;
        var o3 = 0;

        o3 += m3 + n3;
        o2 += o3 >>> 16;
        o3 &= 0xffff;
        o2 += m2 + n2;
        o1 += o2 >>> 16;
        o2 &= 0xffff;
        o1 += m1 + n1;
        o0 += o1 >>> 16;
        o1 &= 0xffff;
        o0 += m0 + n0;
        o0 &= 0xffff;

        m[0] = (o0 << 16) | o1;
        m[1] = (o2 << 16) | o3;
    }

    private static void X64Multiply(int[] m, int[] n)
    {
        // Match murmurHash3.js / @thenightwatch/core step-for-step (16-bit limbs).
        var m0 = (m[0] >>> 16) & 0xffff;
        var m1 = m[0] & 0xffff;
        var m2 = (m[1] >>> 16) & 0xffff;
        var m3 = m[1] & 0xffff;
        var n0 = (n[0] >>> 16) & 0xffff;
        var n1 = n[0] & 0xffff;
        var n2 = (n[1] >>> 16) & 0xffff;
        var n3 = n[1] & 0xffff;
        var o0 = 0;
        var o1 = 0;
        var o2 = 0;
        var o3 = 0;

        o3 += m3 * n3;
        o2 += o3 >>> 16;
        o3 &= 0xffff;
        o2 += m2 * n3;
        o1 += o2 >>> 16;
        o2 &= 0xffff;
        o2 += m3 * n2;
        o1 += o2 >>> 16;
        o2 &= 0xffff;
        o1 += m1 * n3;
        o0 += o1 >>> 16;
        o1 &= 0xffff;
        o1 += m2 * n2;
        o0 += o1 >>> 16;
        o1 &= 0xffff;
        o1 += m3 * n1;
        o0 += o1 >>> 16;
        o1 &= 0xffff;
        o0 += m0 * n3 + m1 * n2 + m2 * n1 + m3 * n0;
        o0 &= 0xffff;

        m[0] = (o0 << 16) | o1;
        m[1] = (o2 << 16) | o3;
    }

    private static void X64Rotl(int[] m, int bits)
    {
        var m0 = m[0];
        bits %= 64;
        if (bits == 32)
        {
            m[0] = m[1];
            m[1] = m0;
        }
        else if (bits < 32)
        {
            m[0] = (m0 << bits) | (m[1] >>> (32 - bits));
            m[1] = (m[1] << bits) | (m0 >>> (32 - bits));
        }
        else
        {
            bits -= 32;
            m[0] = (m[1] << bits) | (m0 >>> (32 - bits));
            m[1] = (m0 << bits) | (m[1] >>> (32 - bits));
        }
    }

    private static void X64LeftShift(int[] m, int bits)
    {
        bits %= 64;
        if (bits == 0) return;
        if (bits < 32)
        {
            m[0] = m[1] >>> (32 - bits);
            m[1] = m[1] << bits;
        }
        else
        {
            m[0] = m[1] << (bits - 32);
            m[1] = 0;
        }
    }

    private static void X64Xor(int[] m, int[] n)
    {
        m[0] ^= n[0];
        m[1] ^= n[1];
    }

    private static void X64Fmix(int[] h)
    {
        var shifted = new[] { 0, h[0] >>> 1 };
        X64Xor(h, shifted);
        X64Multiply(h, F1);
        shifted[1] = h[0] >>> 1;
        X64Xor(h, shifted);
        X64Multiply(h, F2);
        shifted[1] = h[0] >>> 1;
        X64Xor(h, shifted);
    }
}
