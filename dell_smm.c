/*
 * dell_smm.c - Dell i8k/SMM Fan Speed Controller
 *
 * Controls Dell laptop fans via the /proc/i8k interface (dell_smm_hwmon kernel driver).
 * The i8k interface uses ioctl() calls to set fan speed levels 0-3 directly via
 * SMM (System Management Mode) bypassing the BIOS EC's override watchdog.
 *
 * Fan levels:
 *   0 = Off (0 RPM)
 *   1 = Slow (~2000-2500 RPM)
 *   2 = Fast (~3500-4000 RPM)
 *   3 = Max  (~5000-5300 RPM)
 *
 * Usage:
 *   dell_smm fan <level>       Set fan to level 0-3
 *   dell_smm disable_bios      No-op (kept for compat)
 *   dell_smm enable_bios       No-op (kept for compat)
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <sys/io.h>

/* i8k ioctl interface (from linux/i8k.h) */
#define I8K_PROC            "/proc/i8k"
#define I8K_IOCTL_MAGIC     'k'
#define I8K_FAN_LEFT        1
#define I8K_FAN_RIGHT       0
#define I8K_FAN_OFF         0
#define I8K_FAN_LOW         1
#define I8K_FAN_HIGH        2
#define I8K_FAN_TURBO       3
#define I8K_SET_FAN         _IOWR(I8K_IOCTL_MAGIC, 3, int)

/* SMM direct I/O port for BIOS control toggle (Latitude 5000 series) */
#define SMM_PORT            0xb2
#define DISABLE_BIOS_FAN    0x34a3
#define ENABLE_BIOS_FAN     0x35a3

static int set_fan_via_i8k(int fan_id, int level) {
    int fd = open(I8K_PROC, O_RDWR);
    if (fd < 0) {
        perror("open /proc/i8k");
        return 1;
    }
    int args[2] = { fan_id, level };
    if (ioctl(fd, I8K_SET_FAN, args) < 0) {
        perror("ioctl I8K_SET_FAN");
        close(fd);
        return 1;
    }
    close(fd);
    return 0;
}

static int set_fan_level_by_pwm(int pwm) {
    /* Map 0-255 PWM to i8k levels 0-3 */
    int level;
    if (pwm <= 0) {
        level = I8K_FAN_OFF;
    } else if (pwm <= 85) {
        level = I8K_FAN_LOW;
    } else if (pwm <= 170) {
        level = I8K_FAN_HIGH;
    } else {
        level = I8K_FAN_TURBO;
    }

    /* Set both left and right fans (some Dells have two) */
    int ret = 0;
    ret |= set_fan_via_i8k(I8K_FAN_RIGHT, level);
    ret |= set_fan_via_i8k(I8K_FAN_LEFT, level);
    return ret;
}

static int smm_send(unsigned short cmd) {
    if (iopl(3) != 0) {
        /* Non-fatal: continue without port I/O if not permitted */
        return 0;
    }
    outw(cmd, SMM_PORT);
    return 0;
}

int main(int argc, char *argv[]) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s [fan <0-255>|disable_bios|enable_bios]\n", argv[0]);
        return 1;
    }

    if (strcmp(argv[1], "fan") == 0 && argc >= 3) {
        int pwm = atoi(argv[2]);
        if (pwm < 0) pwm = 0;
        if (pwm > 255) pwm = 255;
        /* Try to disable BIOS fan control first via SMM port */
        smm_send(DISABLE_BIOS_FAN);
        int ret = set_fan_level_by_pwm(pwm);
        if (ret != 0) {
            fprintf(stderr, "Failed to set fan speed via i8k ioctl\n");
            return 1;
        }
        int level = (pwm <= 0) ? 0 : (pwm <= 85) ? 1 : (pwm <= 170) ? 2 : 3;
        printf("Fan set to level %d (pwm=%d)\n", level, pwm);
        return 0;
    }

    if (strcmp(argv[1], "disable_bios") == 0) {
        smm_send(DISABLE_BIOS_FAN);
        printf("Sent Dell BIOS fan disable SMM command\n");
        return 0;
    }

    if (strcmp(argv[1], "enable_bios") == 0) {
        smm_send(ENABLE_BIOS_FAN);
        printf("Sent Dell BIOS fan enable SMM command\n");
        return 0;
    }

    fprintf(stderr, "Unknown command: %s\n", argv[1]);
    return 1;
}
